import React from 'react';
import { useSelector } from 'react-redux';
import useEnsureMoviesLoaded from 'Helpers/Hooks/useEnsureMoviesLoaded';
import Movie from 'Movie/Movie';
import createAllMoviesSelector from 'Store/Selectors/createAllMoviesSelector';
import sortByProp from 'Utilities/Array/sortByProp';
import FilterBuilderRowValue from './FilterBuilderRowValue';
import FilterBuilderRowValueProps from './FilterBuilderRowValueProps';

function MovieFilterBuilderRowValue(props: FilterBuilderRowValueProps) {
  useEnsureMoviesLoaded();

  const allMovies: Movie[] = useSelector(createAllMoviesSelector());

  const tagList = allMovies
    .map((movie) => ({ id: movie.id, name: movie.title }))
    .sort(sortByProp('name'));

  return <FilterBuilderRowValue {...props} tagList={tagList} />;
}

export default MovieFilterBuilderRowValue;
