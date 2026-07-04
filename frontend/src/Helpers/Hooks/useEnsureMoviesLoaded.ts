import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AppState from 'App/State/AppState';
import { fetchMovies } from 'Store/Actions/movieActions';

function useEnsureMoviesLoaded(enabled = true) {
  const dispatch = useDispatch();
  const { isFetching, isPopulated } = useSelector((state: AppState) => {
    return state.movies;
  });

  useEffect(() => {
    if (enabled && !isFetching && !isPopulated) {
      dispatch(fetchMovies());
    }
  }, [dispatch, enabled, isFetching, isPopulated]);
}

export default useEnsureMoviesLoaded;
