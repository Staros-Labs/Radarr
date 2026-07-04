import { createAction } from 'redux-actions';
import { batchActions } from 'redux-batched-actions';
import { filterBuilderTypes, filterBuilderValueTypes, sortDirections } from 'Helpers/Props';
import { createThunk, handleThunks } from 'Store/thunks';
import sortByProp from 'Utilities/Array/sortByProp';
import createAjaxRequest from 'Utilities/createAjaxRequest';
import serverSideCollectionHandlers from 'Utilities/serverSideCollectionHandlers';
import translate from 'Utilities/String/translate';
import createHandleActions from './Creators/createHandleActions';
import createServerSideCollectionHandlers from './Creators/createServerSideCollectionHandlers';
import createSetTableOptionReducer from './Creators/Reducers/createSetTableOptionReducer';
import {
  filterPredicates,
  filters,
  mergeMovies,
  sortPredicates,
} from './movieActions';
import { set, update, updateServerSideCollection } from './baseActions';

//
// Variables

export const section = 'movieIndex';

//
// State

export const defaultState = {
  isFetching: false,
  isPopulated: false,
  error: null,
  page: 1,
  pageSize: 20,
  totalPages: 1,
  totalRecords: 0,
  items: [],
  isSaving: false,
  saveError: null,
  isDeleting: false,
  deleteError: null,
  sortKey: 'sortTitle',
  sortDirection: sortDirections.ASCENDING,
  secondarySortKey: 'sortTitle',
  secondarySortDirection: sortDirections.ASCENDING,
  view: 'posters',

  posterOptions: {
    detailedProgressBar: false,
    size: 'large',
    showTitle: false,
    showMonitored: true,
    showQualityProfile: true,
    showCinemaRelease: false,
    showDigitalRelease: false,
    showPhysicalRelease: false,
    showReleaseDate: false,
    showTmdbRating: false,
    showImdbRating: false,
    showRottenTomatoesRating: false,
    showTraktRating: false,
    showTags: false,
    showSearchAction: false
  },

  overviewOptions: {
    detailedProgressBar: false,
    size: 'medium',
    showMonitored: true,
    showStudio: true,
    showQualityProfile: true,
    showAdded: false,
    showPath: false,
    showSizeOnDisk: false,
    showTags: false,
    showSearchAction: false
  },

  tableOptions: {
    showSearchAction: false
  },

  columns: [
    {
      name: 'select',
      columnLabel: 'Select',
      isSortable: false,
      isVisible: true,
      isModifiable: false,
      isHidden: true
    },
    {
      name: 'status',
      columnLabel: () => translate('ReleaseStatus'),
      isSortable: true,
      isVisible: true,
      isModifiable: false
    },
    {
      name: 'sortTitle',
      label: () => translate('MovieTitle'),
      isSortable: true,
      isVisible: true,
      isModifiable: false
    },
    {
      name: 'originalTitle',
      label: () => translate('OriginalTitle'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'collection',
      label: () => translate('Collection'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'studio',
      label: () => translate('Studio'),
      isSortable: true,
      isVisible: true
    },
    {
      name: 'qualityProfileId',
      label: () => translate('QualityProfile'),
      isSortable: true,
      isVisible: true
    },
    {
      name: 'originalLanguage',
      label: () => translate('OriginalLanguage'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'added',
      label: () => translate('Added'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'year',
      label: () => translate('Year'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'inCinemas',
      label: () => translate('InCinemas'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'digitalRelease',
      label: () => translate('DigitalRelease'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'physicalRelease',
      label: () => translate('PhysicalRelease'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'releaseDate',
      label: () => translate('ReleaseDate'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'runtime',
      label: () => translate('Runtime'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'minimumAvailability',
      label: () => translate('MinimumAvailability'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'path',
      label: () => translate('Path'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'sizeOnDisk',
      label: () => translate('SizeOnDisk'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'genres',
      label: () => translate('Genres'),
      isSortable: false,
      isVisible: false
    },
    {
      name: 'keywords',
      label: () => translate('Keywords'),
      isSortable: false,
      isVisible: false
    },
    {
      name: 'movieStatus',
      label: () => translate('Status'),
      isSortable: true,
      isVisible: true
    },
    {
      name: 'tmdbRating',
      label: () => translate('TmdbRating'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'imdbRating',
      label: () => translate('ImdbRating'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'rottenTomatoesRating',
      label: () => translate('RottenTomatoesRating'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'traktRating',
      label: () => translate('TraktRating'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'popularity',
      label: () => translate('Popularity'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'certification',
      label: () => translate('Certification'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'releaseGroups',
      label: () => translate('ReleaseGroup'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'tags',
      label: () => translate('Tags'),
      isSortable: true,
      isVisible: false
    },
    {
      name: 'actions',
      columnLabel: () => translate('Actions'),
      isVisible: true,
      isModifiable: false
    }
  ],

  sortPredicates: {
    ...sortPredicates,

    studio: function(item) {
      const studio = item.studio;

      return studio ? studio.toLowerCase() : '';
    },

    collection: function(item) {
      const { collection ={} } = item;

      return collection.title;
    },

    originalLanguage: function(item) {
      const { originalLanguage ={} } = item;

      return originalLanguage.name;
    },

    releaseGroups: function(item) {
      const { statistics = {} } = item;
      const { releaseGroups = [] } = statistics;

      return releaseGroups.length ?
        releaseGroups
          .map((group) => group.toLowerCase())
          .sort((a, b) => a.localeCompare(b)) :
        undefined;
    },

    tmdbRating: function({ ratings = {} }) {
      return ratings.tmdb ? ratings.tmdb.value : 0;
    },

    imdbRating: function({ ratings = {} }) {
      return ratings.imdb ? ratings.imdb.value : 0;
    },

    rottenTomatoesRating: function({ ratings = {} }) {
      return ratings.rottenTomatoes ? ratings.rottenTomatoes.value : -1;
    },

    traktRating: function({ ratings = {} }) {
      return ratings.trakt ? ratings.trakt.value : 0;
    }
  },

  selectedFilterKey: 'all',

  filters,
  filterPredicates,

  filterBuilderProps: [
    {
      name: 'monitored',
      label: () => translate('Monitored'),
      type: filterBuilderTypes.EXACT,
      valueType: filterBuilderValueTypes.BOOL
    },
    {
      name: 'isAvailable',
      label: () => translate('ConsideredAvailable'),
      type: filterBuilderTypes.EXACT,
      valueType: filterBuilderValueTypes.BOOL
    },
    {
      name: 'minimumAvailability',
      label: () => translate('MinimumAvailability'),
      type: filterBuilderTypes.EXACT,
      valueType: filterBuilderValueTypes.MINIMUM_AVAILABILITY
    },
    {
      name: 'title',
      label: () => translate('Title'),
      type: filterBuilderTypes.STRING
    },
    {
      name: 'originalTitle',
      label: () => translate('OriginalTitle'),
      type: filterBuilderTypes.STRING
    },
    {
      name: 'originalLanguage',
      label: () => translate('OriginalLanguage'),
      type: filterBuilderTypes.EXACT,
      optionsSelector: function(items) {
        const collectionList = items.reduce((acc, movie) => {
          if (movie.originalLanguage) {
            acc.push({
              id: movie.originalLanguage.name,
              name: movie.originalLanguage.name
            });
          }

          return acc;
        }, []);

        return collectionList.sort(sortByProp('name'));
      }
    },
    {
      name: 'releaseGroups',
      label: () => translate('ReleaseGroups'),
      type: filterBuilderTypes.ARRAY,
      optionsSelector: function(items) {
        const groupList = items.reduce((acc, movie) => {
          const { statistics = {} } = movie;
          const { releaseGroups = [] } = statistics;

          releaseGroups.forEach((releaseGroup) => {
            acc.push({
              id: releaseGroup,
              name: releaseGroup
            });
          });

          return acc;
        }, []);

        return groupList.sort(sortByProp('name'));
      }
    },
    {
      name: 'status',
      label: () => translate('ReleaseStatus'),
      type: filterBuilderTypes.EXACT,
      valueType: filterBuilderValueTypes.RELEASE_STATUS
    },
    {
      name: 'studio',
      label: () => translate('Studio'),
      type: filterBuilderTypes.EXACT,
      optionsSelector: function(items) {
        const tagList = items.reduce((acc, movie) => {
          if (movie.studio) {
            acc.push({
              id: movie.studio,
              name: movie.studio
            });
          }

          return acc;
        }, []);

        return tagList.sort(sortByProp('name'));
      }
    },
    {
      name: 'collection',
      label: () => translate('Collection'),
      type: filterBuilderTypes.ARRAY,
      optionsSelector: function(items) {
        const collectionList = items.reduce((acc, movie) => {
          if (movie.collection && movie.collection.title) {
            acc.push({
              id: movie.collection.title,
              name: movie.collection.title
            });
          }

          return acc;
        }, []);

        return collectionList.sort(sortByProp('name'));
      }
    },
    {
      name: 'qualityProfileId',
      label: () => translate('QualityProfile'),
      type: filterBuilderTypes.EXACT,
      valueType: filterBuilderValueTypes.QUALITY_PROFILE
    },
    {
      name: 'added',
      label: () => translate('Added'),
      type: filterBuilderTypes.DATE,
      valueType: filterBuilderValueTypes.DATE
    },
    {
      name: 'year',
      label: () => translate('Year'),
      type: filterBuilderTypes.NUMBER
    },
    {
      name: 'inCinemas',
      label: () => translate('InCinemas'),
      type: filterBuilderTypes.DATE,
      valueType: filterBuilderValueTypes.DATE
    },
    {
      name: 'physicalRelease',
      label: () => translate('PhysicalRelease'),
      type: filterBuilderTypes.DATE,
      valueType: filterBuilderValueTypes.DATE
    },
    {
      name: 'digitalRelease',
      label: () => translate('DigitalRelease'),
      type: filterBuilderTypes.DATE,
      valueType: filterBuilderValueTypes.DATE
    },
    {
      name: 'releaseDate',
      label: () => translate('ReleaseDate'),
      type: filterBuilderTypes.DATE,
      valueType: filterBuilderValueTypes.DATE
    },
    {
      name: 'runtime',
      label: () => translate('Runtime'),
      type: filterBuilderTypes.NUMBER
    },
    {
      name: 'path',
      label: () => translate('Path'),
      type: filterBuilderTypes.STRING
    },
    {
      name: 'sizeOnDisk',
      label: () => translate('SizeOnDisk'),
      type: filterBuilderTypes.NUMBER,
      valueType: filterBuilderValueTypes.BYTES
    },
    {
      name: 'genres',
      label: () => translate('Genres'),
      type: filterBuilderTypes.ARRAY,
      optionsSelector: function(items) {
        const genreList = items.reduce((acc, { genres = [] }) => {
          genres.forEach((genre) => {
            acc.push({
              id: genre,
              name: genre
            });
          });

          return acc;
        }, []);

        return genreList.sort(sortByProp('name'));
      }
    },
    {
      name: 'keywords',
      label: () => translate('Keywords'),
      type: filterBuilderTypes.ARRAY,
      optionsSelector: function(items) {
        const keywordList = items.reduce((acc, { keywords = [] }) => {
          keywords.forEach((keyword) => {
            if (acc.findIndex((a) => a.id === keyword) === -1) {
              acc.push({
                id: keyword,
                name: keyword
              });
            }
          });

          return acc;
        }, []);

        return keywordList.sort(sortByProp('name'));
      }
    },
    {
      name: 'tmdbRating',
      label: () => translate('TmdbRating'),
      type: filterBuilderTypes.NUMBER
    },
    {
      name: 'tmdbVotes',
      label: () => translate('TmdbVotes'),
      type: filterBuilderTypes.NUMBER
    },
    {
      name: 'imdbRating',
      label: () => translate('ImdbRating'),
      type: filterBuilderTypes.NUMBER,
      numberFractionDigits: 1
    },
    {
      name: 'imdbVotes',
      label: () => translate('ImdbVotes'),
      type: filterBuilderTypes.NUMBER
    },
    {
      name: 'rottenTomatoesRating',
      label: () => translate('RottenTomatoesRating'),
      type: filterBuilderTypes.NUMBER
    },
    {
      name: 'traktRating',
      label: () => translate('TraktRating'),
      type: filterBuilderTypes.NUMBER
    },
    {
      name: 'traktVotes',
      label: () => translate('TraktVotes'),
      type: filterBuilderTypes.NUMBER
    },
    {
      name: 'popularity',
      label: () => translate('Popularity'),
      type: filterBuilderTypes.NUMBER
    },
    {
      name: 'certification',
      label: () => translate('Certification'),
      type: filterBuilderTypes.EXACT,
      optionsSelector: function(items) {
        const certificationList = items.reduce((acc, movie) => {
          if (movie.certification) {
            acc.push({
              id: movie.certification,
              name: movie.certification
            });
          }

          return acc;
        }, []);

        return certificationList.sort(sortByProp('name'));
      }
    },
    {
      name: 'tags',
      label: () => translate('Tags'),
      type: filterBuilderTypes.ARRAY,
      valueType: filterBuilderValueTypes.TAG
    }
  ]
};

export const persistState = [
  'movieIndex.pageSize',
  'movieIndex.sortKey',
  'movieIndex.sortDirection',
  'movieIndex.selectedFilterKey',
  'movieIndex.view',
  'movieIndex.columns',
  'movieIndex.posterOptions',
  'movieIndex.overviewOptions',
  'movieIndex.tableOptions'
];

//
// Actions Types

export const FETCH_MOVIE_INDEX = 'movieIndex/fetchMovieIndex';
export const GOTO_FIRST_MOVIE_INDEX_PAGE = 'movieIndex/gotoMovieIndexFirstPage';
export const GOTO_PREVIOUS_MOVIE_INDEX_PAGE =
  'movieIndex/gotoMovieIndexPreviousPage';
export const GOTO_NEXT_MOVIE_INDEX_PAGE = 'movieIndex/gotoMovieIndexNextPage';
export const GOTO_LAST_MOVIE_INDEX_PAGE = 'movieIndex/gotoMovieIndexLastPage';
export const GOTO_MOVIE_INDEX_PAGE = 'movieIndex/gotoMovieIndexPage';
export const SET_MOVIE_SORT = 'movieIndex/setMovieSort';
export const SET_MOVIE_FILTER = 'movieIndex/setMovieFilter';
export const SET_MOVIE_VIEW = 'movieIndex/setMovieView';
export const SET_MOVIE_TABLE_OPTION = 'movieIndex/setMovieTableOption';
export const SET_MOVIE_POSTER_OPTION = 'movieIndex/setMoviePosterOption';
export const SET_MOVIE_OVERVIEW_OPTION = 'movieIndex/setMovieOverviewOption';
export const FETCH_MOVIE_INDEX_IDS = 'movieIndex/fetchMovieIndexIds';

//
// Action Creators

export const fetchMovieIndex = createThunk(FETCH_MOVIE_INDEX);
export const gotoMovieIndexFirstPage = createThunk(GOTO_FIRST_MOVIE_INDEX_PAGE);
export const gotoMovieIndexPreviousPage = createThunk(
  GOTO_PREVIOUS_MOVIE_INDEX_PAGE
);
export const gotoMovieIndexNextPage = createThunk(GOTO_NEXT_MOVIE_INDEX_PAGE);
export const gotoMovieIndexLastPage = createThunk(GOTO_LAST_MOVIE_INDEX_PAGE);
export const gotoMovieIndexPage = createThunk(GOTO_MOVIE_INDEX_PAGE);
export const setMovieSort = createThunk(SET_MOVIE_SORT);
export const setMovieFilter = createThunk(SET_MOVIE_FILTER);
export const setMovieView = createAction(SET_MOVIE_VIEW);
export const setMovieTableOption = createAction(SET_MOVIE_TABLE_OPTION);
export const setMoviePosterOption = createAction(SET_MOVIE_POSTER_OPTION);
export const setMovieOverviewOption = createAction(SET_MOVIE_OVERVIEW_OPTION);
export const fetchMovieIndexIds = createThunk(FETCH_MOVIE_INDEX_IDS);

function augmentFetchData(getState, payload, data) {
  const movieIndex = getState().movieIndex;
  const selectedFilterKey =
    payload?.selectedFilterKey ?? movieIndex.selectedFilterKey;

  delete data.selectedFilterKey;

  if (typeof selectedFilterKey === 'number') {
    data.customFilterId = selectedFilterKey;
  } else {
    data.filterKey = selectedFilterKey;
  }
}

//
// Reducers

handleThunks({
  ...createServerSideCollectionHandlers(
    section,
    '/movie/paged',
    fetchMovieIndex,
    {
      [serverSideCollectionHandlers.FETCH]: FETCH_MOVIE_INDEX,
      [serverSideCollectionHandlers.FIRST_PAGE]: GOTO_FIRST_MOVIE_INDEX_PAGE,
      [serverSideCollectionHandlers.PREVIOUS_PAGE]:
        GOTO_PREVIOUS_MOVIE_INDEX_PAGE,
      [serverSideCollectionHandlers.NEXT_PAGE]: GOTO_NEXT_MOVIE_INDEX_PAGE,
      [serverSideCollectionHandlers.LAST_PAGE]: GOTO_LAST_MOVIE_INDEX_PAGE,
      [serverSideCollectionHandlers.EXACT_PAGE]: GOTO_MOVIE_INDEX_PAGE,
      [serverSideCollectionHandlers.SORT]: SET_MOVIE_SORT,
      [serverSideCollectionHandlers.FILTER]: SET_MOVIE_FILTER
    },
    augmentFetchData
  ),

  [FETCH_MOVIE_INDEX]: (getState, payload, dispatch) => {
    dispatch(set({ section, isFetching: true }));

    const movieIndex = getState().movieIndex;
    const data = {
      page: payload.page || movieIndex.page || 1,
      pageSize: movieIndex.pageSize,
      sortKey: movieIndex.sortKey,
      sortDirection: movieIndex.sortDirection
    };

    augmentFetchData(getState, payload, data);

    const promise = createAjaxRequest({
      url: '/movie/paged',
      data,
      traditional: true
    }).request;

    promise.done((response) => {
      const nextMovies = mergeMovies(getState().movies.items, response.records);

      dispatch(batchActions([
        updateServerSideCollection({ section, data: response }),
        update({ section: 'movies', data: nextMovies }),
        set({
          section,
          isFetching: false,
          isPopulated: true,
          error: null
        })
      ]));
    });

    promise.fail((xhr) => {
      dispatch(set({
        section,
        isFetching: false,
        isPopulated: false,
        error: xhr
      }));
    });

    return promise;
  },

  [FETCH_MOVIE_INDEX_IDS]: (getState, payload) => {
    const movieIndex = getState().movieIndex;
    const data = {
      sortKey: payload?.sortKey ?? movieIndex.sortKey,
      sortDirection: payload?.sortDirection ?? movieIndex.sortDirection
    };

    augmentFetchData(getState, payload, data);

    return createAjaxRequest({
      url: '/movie/ids',
      data,
      traditional: true
    }).request;
  },
});

export const reducers = createHandleActions({

  [SET_MOVIE_VIEW]: function(state, { payload }) {
    return Object.assign({}, state, { view: payload.view });
  },

  [SET_MOVIE_TABLE_OPTION]: createSetTableOptionReducer(section),

  [SET_MOVIE_POSTER_OPTION]: function(state, { payload }) {
    const posterOptions = state.posterOptions;

    return {
      ...state,
      posterOptions: {
        ...posterOptions,
        ...payload
      }
    };
  },

  [SET_MOVIE_OVERVIEW_OPTION]: function(state, { payload }) {
    const overviewOptions = state.overviewOptions;

    return {
      ...state,
      overviewOptions: {
        ...overviewOptions,
        ...payload
      }
    };
  }

}, defaultState, section);
