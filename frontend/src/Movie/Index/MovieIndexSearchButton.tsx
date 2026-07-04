import React, { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useSelect } from 'App/SelectContext';
import AppState from 'App/State/AppState';
import { MOVIE_SEARCH } from 'Commands/commandNames';
import ConfirmModal from 'Components/Modal/ConfirmModal';
import PageToolbarButton from 'Components/Page/Toolbar/PageToolbarButton';
import { icons, kinds } from 'Helpers/Props';
import { executeCommand } from 'Store/Actions/commandActions';
import { fetchMovieIndexIds } from 'Store/Actions/movieIndexActions';
import createCommandExecutingSelector from 'Store/Selectors/createCommandExecutingSelector';
import { executeThunk } from 'Store/thunks';
import translate from 'Utilities/String/translate';
import getSelectedIds from 'Utilities/Table/getSelectedIds';

interface MovieIndexSearchButtonProps {
  isSelectMode: boolean;
  selectedFilterKey: string | number;
  overflowComponent: React.FunctionComponent<never>;
}

function MovieIndexSearchButton(props: MovieIndexSearchButtonProps) {
  const isSearching = useSelector(createCommandExecutingSelector(MOVIE_SEARCH));
  const totalRecords =
    useSelector((state: AppState) => state.movieIndex.totalRecords) ?? 0;

  const dispatch = useDispatch();
  const store = useStore<AppState>();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const { isSelectMode, selectedFilterKey } = props;
  const [selectState] = useSelect();
  const { selectedState } = selectState;

  const selectedMovieIds = useMemo(() => {
    return getSelectedIds(selectedState);
  }, [selectedState]);

  const searchCount =
    isSelectMode && selectedMovieIds.length > 0
      ? selectedMovieIds.length
      : totalRecords;

  const searchIndexLabel =
    selectedFilterKey === 'all'
      ? translate('SearchAll')
      : translate('SearchFiltered');

  const searchSelectLabel =
    selectedMovieIds.length > 0
      ? translate('SearchSelected')
      : translate('SearchAll');

  const onPress = useCallback(() => {
    setIsConfirmModalOpen(false);

    const request =
      isSelectMode && selectedMovieIds.length > 0
        ? null
        : executeThunk<number[]>(
            fetchMovieIndexIds(),
            dispatch,
            store.getState
          );

    if (!request) {
      dispatch(
        executeCommand({
          name: MOVIE_SEARCH,
          movieIds: selectedMovieIds,
        })
      );

      return;
    }

    request.done((movieIds: number[]) => {
      dispatch(
        executeCommand({
          name: MOVIE_SEARCH,
          movieIds,
        })
      );
    });
  }, [dispatch, isSelectMode, selectedMovieIds, store]);

  const onConfirmPress = useCallback(() => {
    setIsConfirmModalOpen(true);
  }, []);

  const onConfirmModalClose = useCallback(() => {
    setIsConfirmModalOpen(false);
  }, []);

  return (
    <>
      <PageToolbarButton
        label={isSelectMode ? searchSelectLabel : searchIndexLabel}
        isSpinning={isSearching}
        isDisabled={!searchCount}
        iconName={icons.SEARCH}
        onPress={searchCount > 5 ? onConfirmPress : onPress}
      />

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        kind={kinds.DANGER}
        title={isSelectMode ? searchSelectLabel : searchIndexLabel}
        message={translate('SearchMoviesConfirmationMessageText', {
          count: searchCount,
        })}
        confirmLabel={isSelectMode ? searchSelectLabel : searchIndexLabel}
        onConfirm={onPress}
        onCancel={onConfirmModalClose}
      />
    </>
  );
}

export default MovieIndexSearchButton;
