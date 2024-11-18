const { addonBuilder } = require('stremio-addon-sdk');
const fetch = require('isomorphic-fetch');

const TMDB_API_KEY = '8838f8a5f692a9176ea733c099061246';
const OMDB_API_KEY = 'cc08f4e1';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map();

const manifest = {
    id: 'org.romanianmedia',
    version: '1.0.0',
    name: 'Romanian Media',
    description: 'Filme și Seriale Românești',
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

async function fetchWithRetry(url, options = {}, retries = 3) {
    try {
        const response = await fetch(url, {
            ...options,
            timeout: 5000
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return fetchWithRetry(url, options, retries - 1);
        }
        throw error;
    }
}

function getCacheKey(type, skip) {
    return `${type}-${skip}`;
}

function getCachedData(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    return null;
}

async function getImdbRating(imdbId) {
    if (!imdbId) return null;
    
    const cacheKey = `imdb-${imdbId}`;
    const cached = getCachedData(cacheKey);
    if (cached !== null) return cached;

    try {
        const data = await fetchWithRetry(
            `https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`
        );
        
        const rating = data.imdbRating && data.imdbRating !== 'N/A' ? 
            parseFloat(data.imdbRating) : null;
            
        cache.set(cacheKey, { data: rating, timestamp: Date.now() });
        return rating;
    } catch (error) {
        console.error('Error fetching IMDB rating:', error);
        return null;
    }
}

async function getMovies(skip) {
    const cacheKey = getCacheKey('movies', skip);
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const page = Math.floor(skip / 20) + 1;
        const data = await fetchWithRetry(
            `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=ro&language=ro-RO&sort_by=popularity.desc&page=${page}`
        );

        if (!data?.results?.length) {
            console.error('No movie results found:', data);
            return [];
        }

        const movies = await Promise.all(data.results.map(async movie => {
            try {
                const details = await fetchWithRetry(
                    `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}&language=ro-RO&append_to_response=external_ids`
                );
                
                const imdbId = details.external_ids?.imdb_id;
                const imdbRating = await getImdbRating(imdbId);

                return {
                    id: imdbId || `tmdb:${movie.id}`,
                    type: 'movie',
                    name: movie.title || movie.original_title,
                    poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
                    background: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null,
                    description: movie.overview || '',
                    releaseInfo: movie.release_date?.substring(0, 4) || 'Unknown',
                    imdbRating: imdbRating
                };
            } catch (error) {
                console.error(`Error fetching movie details for ${movie.id}:`, error);
                return null;
            }
        }));

        const validMovies = movies.filter(Boolean);
        cache.set(cacheKey, { data: validMovies, timestamp: Date.now() });
        return validMovies;
    } catch (error) {
        console.error('Error fetching movies:', error);
        return [];
    }
}

async function getSeries(skip) {
    const cacheKey = getCacheKey('series', skip);
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const page = Math.floor(skip / 20) + 1;
        const data = await fetchWithRetry(
            `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=ro&language=ro-RO&sort_by=popularity.desc&page=${page}`
        );

        if (!data?.results?.length) {
            console.error('No series results found:', data);
            return [];
        }

        const series = await Promise.all(data.results.map(async show => {
            try {
                const details = await fetchWithRetry(
                    `https://api.themoviedb.org/3/tv/${show.id}?api_key=${TMDB_API_KEY}&language=ro-RO&append_to_response=external_ids`
                );

                const imdbId = details.external_ids?.imdb_id;
                const imdbRating = await getImdbRating(imdbId);

                return {
                    id: imdbId || `tmdb:${show.id}`,
                    type: 'series',
                    name: show.name || show.original_name,
                    poster: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
                    background: show.backdrop_path ? `https://image.tmdb.org/t/p/original${show.backdrop_path}` : null,
                    description: show.overview || '',
                    releaseInfo: show.first_air_date?.substring(0, 4) || 'Unknown',
                    imdbRating: imdbRating
                };
            } catch (error) {
                console.error(`Error fetching series details for ${show.id}:`, error);
                return null;
            }
        }));

        const validSeries = series.filter(Boolean);
        cache.set(cacheKey, { data: validSeries, timestamp: Date.now() });
        return validSeries;
    } catch (error) {
        console.error('Error fetching series:', error);
        return [];
    }
}

builder.defineCatalogHandler(async ({ type, id, extra }) => {
    const skip = parseInt(extra.skip) || 0;
    
    try {
        if (type === 'movie' && id === 'romanian-movies') {
            const metas = await getMovies(skip);
            return { metas };
        }
        
        if (type === 'series' && id === 'romanian-series') {
            const metas = await getSeries(skip);
            return { metas };
        }
    } catch (error) {
        console.error('Error in catalog handler:', error);
    }
    
    return { metas: [] };
});

module.exports = builder.getInterface();
