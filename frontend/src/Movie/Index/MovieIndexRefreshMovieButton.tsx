import React, { useCallback, useMemo } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useSelect } from 'App/SelectContext';
import AppState from 'App/State/AppState';
import { REFRESH_MOVIE } from 'Commands/commandNames';
import PageToolbarButton from 'Components/Page/Toolbar/PageToolbarButton';
import { icons } from 'Helpers/Props';
import { executeCommand } from 'Store/Actions/commandActions';
import { fetchMovieIndexIds } from 'Store/Actions/movieIndexActions';
import createCommandExecutingSelector from 'Store/Selectors/createCommandExecutingSelector';
import { executeThunk } from 'Store/thunks';
import translate from 'Utilities/String/translate';
import getSelectedIds from 'Utilities/Table/getSelectedIds';

interface MovieIndexRefreshMovieButtonProps {
  isSelectMode: boolean;
  selectedFilterKey: string | number;
}

function MovieIndexRefreshMovieButton(
  props: MovieIndexRefreshMovieButtonProps
) {
  const isRefreshing = useSelector(
    createCommandExecutingSelector(REFRESH_MOVIE)
  );
  const { totalRecords } = useSelector((state: AppState) => state.movieIndex);

  const dispatch = useDispatch();
  const store = useStore<AppState>();
  const { isSelectMode, selectedFilterKey } = props;
  const [selectState] = useSelect();
  const { selectedState } = selectState;

  const selectedMovieIds = useMemo(() => {
    return getSelectedIds(selectedState);
  }, [selectedState]);

  const refreshIndexLabel =
    selectedFilterKey === 'all'
      ? translate('UpdateAll')
      : translate('UpdateFiltered');

  const refreshSelectLabel =
    selectedMovieIds.length > 0
      ? translate('UpdateSelected')
      : translate('UpdateAll');

  const onPress = useCallback(() => {
    const request =
      isSelectMode && selectedMovieIds.length
        ? null
        : executeThunk<number[]>(
            fetchMovieIndexIds(),
            dispatch,
            store.getState
          );

    if (!request) {
      dispatch(
        executeCommand({
          name: REFRESH_MOVIE,
          movieIds: selectedMovieIds,
        })
      );

      return;
    }

    request.done((movieIds: number[]) => {
      dispatch(
        executeCommand({
          name: REFRESH_MOVIE,
          movieIds,
        })
      );
    });
  }, [dispatch, isSelectMode, selectedMovieIds, store]);

  return (
    <PageToolbarButton
      label={isSelectMode ? refreshSelectLabel : refreshIndexLabel}
      isSpinning={isRefreshing}
      isDisabled={!totalRecords}
      iconName={icons.REFRESH}
      onPress={onPress}
    />
  );
}

export default MovieIndexRefreshMovieButton;
