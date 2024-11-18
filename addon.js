const { addonBuilder } = require('stremio-addon-sdk');
const fetch = require('node-fetch');

const TMDB_API_KEY = '8838f8a5f692a9176ea733c099061246';

const manifest = {
    id: 'org.romanianmedia',
    version: '1.0.0',
    name: 'Romanian Media',
    description: 'Filme și Seriale Românești',
    types: ['movie', 'series'],
    catalogs: [
        {
            type: 'movie',
            id: 'romanian-movies',
            name: 'Romanești - Filme',
            extra: [{ name: 'skip' }]
        },
        {
            type: 'series',
            id: 'romanian-series',
            name: 'Romanești - Seriale',
            extra: [{ name: 'skip' }]
        }
    ],
    resources: ['catalog'],
    types: ['movie', 'series']
};

const builder = new addonBuilder(manifest);

async function getImdbRating(imdbId) {
    try {
        const response = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=cc08f4e1`);
        const data = await response.json();
        return data.imdbRating || null;
    } catch (error) {
        console.error('Error fetching IMDB rating:', error);
        return null;
    }
}

async function getMovies(skip) {
    try {
        const response = await fetch(
            `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=ro&language=ro-RO&sort_by=popularity.desc&page=${Math.floor(skip/20) + 1}`
        );
        const data = await response.json();
        
        if (!data.results) {
            console.error('No results found:', data);
            return [];
        }

        const moviesWithRatings = await Promise.all(data.results.map(async movie => {
            const detailsResponse = await fetch(
                `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}&language=ro-RO&append_to_response=external_ids`
            );
            const details = await detailsResponse.json();
            const imdbId = details.external_ids?.imdb_id;
            const imdbRating = imdbId ? await getImdbRating(imdbId) : null;
            
            return {
                id: imdbId || ('tmdb:' + movie.id),
                type: 'movie',
                name: movie.title || movie.original_title,
                poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
                background: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null,
                description: movie.overview || '',
                releaseInfo: movie.release_date?.substring(0, 4),
                imdbRating: imdbRating
            };
        }));

        return moviesWithRatings;
    } catch (error) {
        console.error('Error fetching movies:', error);
        return [];
    }
}

async function getSeries(skip) {
    try {
        const response = await fetch(
            `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=ro&language=ro-RO&sort_by=popularity.desc&page=${Math.floor(skip/20) + 1}`
        );
        const data = await response.json();

        if (!data.results) {
            console.error('No results found:', data);
            return [];
        }

        const seriesWithRatings = await Promise.all(data.results.map(async series => {
            const detailsResponse = await fetch(
                `https://api.themoviedb.org/3/tv/${series.id}?api_key=${TMDB_API_KEY}&language=ro-RO&append_to_response=external_ids`
            );
            const details = await detailsResponse.json();
            const imdbId = details.external_ids?.imdb_id;
            const imdbRating = imdbId ? await getImdbRating(imdbId) : null;

            return {
                id: imdbId || ('tmdb:' + series.id),
                type: 'series',
                name: series.name || series.original_name,
                poster: series.poster_path ? `https://image.tmdb.org/t/p/w500${series.poster_path}` : null,
                background: series.backdrop_path ? `https://image.tmdb.org/t/p/original${series.backdrop_path}` : null,
                description: series.overview || '',
                releaseInfo: series.first_air_date?.substring(0, 4),
                imdbRating: imdbRating
            };
        }));

        return seriesWithRatings;
    } catch (error) {
        console.error('Error fetching series:', error);
        return [];
    }
}

builder.defineCatalogHandler(async ({ type, id, extra }) => {
    const skip = extra.skip || 0;
    
    if (type === 'movie' && id === 'romanian-movies') {
        const metas = await getMovies(skip);
        return { metas };
    }
    
    if (type === 'series' && id === 'romanian-series') {
        const metas = await getSeries(skip);
        return { metas };
    }
    
    return { metas: [] };
});

module.exports = builder.getInterface();