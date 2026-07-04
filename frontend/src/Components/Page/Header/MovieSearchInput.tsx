import { push } from 'connected-react-router';
import { ExtendedKeyboardEvent } from 'mousetrap';
import React, {
  FormEvent,
  KeyboardEvent,
  SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Autosuggest from 'react-autosuggest';
import { useDispatch } from 'react-redux';
import { useDebouncedCallback } from 'use-debounce';
import { Tag } from 'App/State/TagsAppState';
import Icon from 'Components/Icon';
import LoadingIndicator from 'Components/Loading/LoadingIndicator';
import useKeyboardShortcuts from 'Helpers/Hooks/useKeyboardShortcuts';
import { icons } from 'Helpers/Props';
import createAjaxRequest from 'Utilities/createAjaxRequest';
import translate from 'Utilities/String/translate';
import MovieSearchResult from './MovieSearchResult';
import styles from './MovieSearchInput.css';

const ADD_NEW_TYPE = 'addNew';

interface Match {
  key: string;
  refIndex: number;
}

interface AddNewMovieSuggestion {
  type: 'addNew';
  title: string;
}

export interface SuggestedMovie {
  title: string;
  year: number;
  titleSlug: string;
  sortTitle: string;
  images: Array<unknown>;
  alternateTitles: Array<{ title: string }>;
  tmdbId: number;
  imdbId: string;
  tags: Tag[];
}

interface MovieSuggestion {
  title: string;
  indices: number[];
  item: SuggestedMovie;
  matches: Match[];
  refIndex: number;
}

interface Section {
  title: string;
  loading?: boolean;
  suggestions: MovieSuggestion[] | AddNewMovieSuggestion[];
}

function MovieSearchInput() {
  const dispatch = useDispatch();
  const { bindShortcut, unbindShortcut } = useKeyboardShortcuts();

  const [value, setValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<MovieSuggestion[]>([]);

  const autosuggestRef = useRef<Autosuggest>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const latestQueryRef = useRef('');
  const abortRequestRef = useRef<(() => void) | null>(null);

  const suggestionGroups = useMemo(() => {
    const result: Section[] = [];

    if (suggestions.length || isLoading) {
      result.push({
        title: translate('ExistingMovies'),
        loading: isLoading,
        suggestions,
      });
    }

    result.push({
      title: translate('AddNewMovie'),
      suggestions: [
        {
          type: ADD_NEW_TYPE,
          title: value,
        },
      ],
    });

    return result;
  }, [isLoading, suggestions, value]);

  const requestSuggestions = useDebouncedCallback((query: string) => {
    const trimmed = query.trim();

    abortRequestRef.current?.();

    if (!trimmed) {
      setIsLoading(false);
      setSuggestions([]);
      latestQueryRef.current = '';
      return;
    }

    latestQueryRef.current = trimmed;
    setIsLoading(true);

    const { request, abortRequest } = createAjaxRequest({
      url: '/movie/search',
      data: {
        term: trimmed,
      },
      traditional: true,
    });

    abortRequestRef.current = abortRequest;

    request.done((data) => {
      if (latestQueryRef.current !== trimmed) {
        return;
      }

      const nextSuggestions = data.map((item) => {
        return {
          title: item.title,
          indices: [],
          item,
          matches: [
            {
              key: item.matchedKey,
              refIndex: item.matchedIndex,
            },
          ],
          refIndex: item.matchedIndex,
        };
      });

      setSuggestions(nextSuggestions);
      setIsLoading(false);
    });

    request.fail(() => {
      if (latestQueryRef.current !== trimmed) {
        return;
      }

      setSuggestions([]);
      setIsLoading(false);
    });
  }, 250);

  const reset = useCallback(() => {
    abortRequestRef.current?.();
    latestQueryRef.current = '';
    setValue('');
    setSuggestions([]);
    setIsLoading(false);
  }, []);

  const focusInput = useCallback((event: ExtendedKeyboardEvent) => {
    event.preventDefault();
    inputRef.current?.focus();
  }, []);

  const getSectionSuggestions = useCallback((section: Section) => {
    return section.suggestions;
  }, []);

  const renderSectionTitle = useCallback((section: Section) => {
    return (
      <div className={styles.sectionTitle}>
        {section.title}

        {section.loading ? (
          <LoadingIndicator
            className={styles.loading}
            rippleClassName={styles.ripple}
            size={20}
          />
        ) : null}
      </div>
    );
  }, []);

  const getSuggestionValue = useCallback(({ title }: { title: string }) => {
    return title;
  }, []);

  const renderSuggestion = useCallback(
    (
      item: AddNewMovieSuggestion | MovieSuggestion,
      { query }: { query: string }
    ) => {
      if ('type' in item) {
        return (
          <div className={styles.addNewMovieSuggestion}>
            {translate('SearchForQuery', { query })}
          </div>
        );
      }

      return <MovieSearchResult {...item.item} match={item.matches[0]} />;
    },
    []
  );

  const handleChange = useCallback(
    (
      _event: FormEvent<HTMLElement>,
      {
        newValue,
        method,
      }: {
        newValue: string;
        method: 'down' | 'up' | 'escape' | 'enter' | 'click' | 'type';
      }
    ) => {
      if (method === 'up' || method === 'down') {
        return;
      }

      setValue(newValue);
    },
    []
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.shiftKey || event.altKey || event.ctrlKey) {
        return;
      }

      if (event.key === 'Escape') {
        reset();
        return;
      }

      if (event.key !== 'Tab' && event.key !== 'Enter') {
        return;
      }

      if (!autosuggestRef.current) {
        return;
      }

      const { highlightedSectionIndex, highlightedSuggestionIndex } =
        autosuggestRef.current.state;

      if (!suggestions.length || highlightedSectionIndex) {
        dispatch(
          push(
            `${window.Radarr.urlBase}/add/new?term=${encodeURIComponent(value)}`
          )
        );

        inputRef.current?.blur();
        reset();

        return;
      }

      const selectedSuggestion =
        highlightedSuggestionIndex == null
          ? suggestions[0]
          : suggestions[highlightedSuggestionIndex];

      dispatch(
        push(
          `${window.Radarr.urlBase}/movie/${selectedSuggestion.item.titleSlug}`
        )
      );

      inputRef.current?.blur();
      reset();
    },
    [dispatch, reset, suggestions, value]
  );

  const handleBlur = useCallback(() => {
    reset();
  }, [reset]);

  const handleSuggestionsFetchRequested = useCallback(
    ({ value }: { value: string }) => {
      requestSuggestions(value);
    },
    [requestSuggestions]
  );

  const handleSuggestionsClearRequested = useCallback(() => {
    abortRequestRef.current?.();
    latestQueryRef.current = '';
    setSuggestions([]);
    setIsLoading(false);
  }, []);

  const handleSuggestionSelected = useCallback(
    (
      _event: SyntheticEvent,
      { suggestion }: { suggestion: MovieSuggestion | AddNewMovieSuggestion }
    ) => {
      if ('type' in suggestion) {
        dispatch(
          push(
            `${window.Radarr.urlBase}/add/new?term=${encodeURIComponent(value)}`
          )
        );
      } else {
        setValue('');
        dispatch(
          push(`${window.Radarr.urlBase}/movie/${suggestion.item.titleSlug}`)
        );
      }
    },
    [dispatch, value]
  );

  const inputProps = {
    ref: inputRef,
    className: styles.input,
    name: 'movieSearch',
    value,
    placeholder: translate('Search'),
    autoComplete: 'off',
    spellCheck: false,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onBlur: handleBlur,
  };

  const theme = {
    container: styles.container,
    containerOpen: styles.containerOpen,
    suggestionsContainer: styles.movieContainer,
    suggestionsList: styles.list,
    suggestion: styles.listItem,
    suggestionHighlighted: styles.highlighted,
  };

  useEffect(() => {
    bindShortcut('focusMovieSearchInput', focusInput);

    return () => {
      requestSuggestions.cancel();
      abortRequestRef.current?.();
      unbindShortcut('focusMovieSearchInput');
    };
  }, [bindShortcut, focusInput, requestSuggestions, unbindShortcut]);

  return (
    <div className={styles.wrapper}>
      <Icon name={icons.SEARCH} />

      <Autosuggest
        ref={autosuggestRef}
        inputProps={inputProps}
        theme={theme}
        focusInputOnSuggestionClick={false}
        multiSection={true}
        suggestions={suggestionGroups}
        getSectionSuggestions={getSectionSuggestions}
        renderSectionTitle={renderSectionTitle}
        getSuggestionValue={getSuggestionValue}
        renderSuggestion={renderSuggestion}
        onSuggestionSelected={handleSuggestionSelected}
        onSuggestionsFetchRequested={handleSuggestionsFetchRequested}
        onSuggestionsClearRequested={handleSuggestionsClearRequested}
      />
    </div>
  );
}

export default MovieSearchInput;
