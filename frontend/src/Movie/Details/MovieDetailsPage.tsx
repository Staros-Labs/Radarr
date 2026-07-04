import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useParams } from 'react-router';
import { createSelector } from 'reselect';
import AppState from 'App/State/AppState';
import LoadingIndicator from 'Components/Loading/LoadingIndicator';
import NotFound from 'Components/NotFound';
import usePrevious from 'Helpers/Hooks/usePrevious';
import { fetchMovieByTitleSlug } from 'Store/Actions/movieActions';
import { executeThunk } from 'Store/thunks';
import translate from 'Utilities/String/translate';
import MovieDetails from './MovieDetails';

interface RequestFailure {
  status?: number;
}

function createMovieIdSelector(titleSlug: string) {
  return createSelector(
    (state: AppState) => state.movies.items,
    (movies) => {
      return movies.find((movie) => movie.titleSlug === titleSlug)?.id;
    }
  );
}

function MovieDetailsPage() {
  const dispatch = useDispatch();
  const store = useStore<AppState>();
  const { titleSlug } = useParams<{ titleSlug: string }>();
  const movieId = useSelector(createMovieIdSelector(titleSlug));
  const previousMovieId = usePrevious(movieId);
  const [isLoading, setIsLoading] = useState(movieId == null);
  const [isNotFound, setIsNotFound] = useState(false);

  useEffect(() => {
    setIsLoading(movieId == null);
    setIsNotFound(false);
  }, [movieId, titleSlug]);

  useEffect(() => {
    if (movieId != null) {
      return;
    }

    const request = executeThunk(
      fetchMovieByTitleSlug({ titleSlug }),
      dispatch,
      store.getState
    );

    request.done(() => {
      setIsLoading(false);
      setIsNotFound(false);
    });

    request.fail((xhr: RequestFailure) => {
      setIsLoading(false);
      setIsNotFound(xhr.status === 404);
    });
  }, [dispatch, movieId, store, titleSlug]);

  if (isLoading && movieId == null) {
    return <LoadingIndicator />;
  }

  if (isNotFound || (movieId == null && previousMovieId != null)) {
    return <NotFound message={translate('MovieCannotBeFound')} />;
  }

  if (movieId == null) {
    return <NotFound message={translate('MovieCannotBeFound')} />;
  }

  return <MovieDetails movieId={movieId} />;
}

export default MovieDetailsPage;
