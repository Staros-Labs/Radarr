using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Newtonsoft.Json.Linq;
using NzbDrone.Common.Extensions;
using NzbDrone.Core.Configuration;
using NzbDrone.Core.CustomFilters;
using NzbDrone.Core.DecisionEngine.Specifications;
using NzbDrone.Core.Languages;
using NzbDrone.Core.MediaCover;
using NzbDrone.Core.Movies;
using NzbDrone.Core.Movies.Translations;
using NzbDrone.Core.MovieStats;
using NzbDrone.Core.RootFolders;
using NzbDrone.Core.Tags;
using Radarr.Http;

namespace Radarr.Api.V3.Movies
{
    public class MovieIndexPagingRequestResource : PagingRequestResource
    {
        public string FilterKey { get; set; }
        public int? CustomFilterId { get; set; }
    }

    public class MovieNavigationItemResource
    {
        public string Title { get; set; }
        public string TitleSlug { get; set; }
    }

    public class MovieNavigationResource
    {
        public MovieNavigationItemResource PreviousMovie { get; set; }
        public MovieNavigationItemResource NextMovie { get; set; }
    }

    public class MovieSearchResultResource
    {
        public string Title { get; set; }
        public int Year { get; set; }
        public string TitleSlug { get; set; }
        public string SortTitle { get; set; }
        public List<MediaCover> Images { get; set; }
        public List<AlternativeTitleResource> AlternateTitles { get; set; }
        public int TmdbId { get; set; }
        public string ImdbId { get; set; }
        public List<TagLookupResource> Tags { get; set; }
        public string MatchedKey { get; set; }
        public int MatchedIndex { get; set; }
    }

    public class TagLookupResource
    {
        public int Id { get; set; }
        public string Label { get; set; }
    }

    public interface IMovieIndexQueryService
    {
        PagingResource<MovieResource> GetPaged(MovieIndexPagingRequestResource request);
        List<int> GetMovieIds(MovieIndexPagingRequestResource request);
        MovieResource GetMovieByTitleSlug(string titleSlug);
        MovieNavigationResource GetNavigation(string titleSlug);
        List<MovieSearchResultResource> Search(string term, int limit = 20);
    }

    public class MovieIndexQueryService : IMovieIndexQueryService
    {
        private const string DefaultFilterKey = "all";
        private const string DefaultSortKey = "sortTitle";

        private readonly IMovieService _movieService;
        private readonly IMovieTranslationService _movieTranslationService;
        private readonly IMovieStatisticsService _movieStatisticsService;
        private readonly ICustomFilterService _customFilterService;
        private readonly IRootFolderService _rootFolderService;
        private readonly ITagService _tagService;
        private readonly IMapCoversToLocal _coverMapper;
        private readonly IUpgradableSpecification _qualityUpgradableSpecification;
        private readonly IConfigService _configService;

        public MovieIndexQueryService(
            IMovieService movieService,
            IMovieTranslationService movieTranslationService,
            IMovieStatisticsService movieStatisticsService,
            ICustomFilterService customFilterService,
            IRootFolderService rootFolderService,
            ITagService tagService,
            IMapCoversToLocal coverMapper,
            IUpgradableSpecification qualityUpgradableSpecification,
            IConfigService configService)
        {
            _movieService = movieService;
            _movieTranslationService = movieTranslationService;
            _movieStatisticsService = movieStatisticsService;
            _customFilterService = customFilterService;
            _rootFolderService = rootFolderService;
            _tagService = tagService;
            _coverMapper = coverMapper;
            _qualityUpgradableSpecification = qualityUpgradableSpecification;
            _configService = configService;
        }

        public PagingResource<MovieResource> GetPaged(MovieIndexPagingRequestResource request)
        {
            var paging = NormalizeRequest(request);
            var context = BuildContext();
            var filtered = ApplyFilters(context.Items, paging, context);
            var ordered = ApplySort(filtered, paging.SortKey, paging.SortDirection.Value);
            var pageItems = ordered
                .Skip(Math.Max(paging.Page.Value - 1, 0) * paging.PageSize.Value)
                .Take(paging.PageSize.Value)
                .ToList();

            return new PagingResource<MovieResource>(paging)
            {
                TotalRecords = filtered.Count,
                Records = MapResources(pageItems, context)
            };
        }

        public List<int> GetMovieIds(MovieIndexPagingRequestResource request)
        {
            var paging = NormalizeRequest(request);
            var context = BuildContext();

            return ApplySort(
                ApplyFilters(context.Items, paging, context),
                paging.SortKey,
                paging.SortDirection.Value)
                .Select((item) => item.Movie.Id)
                .ToList();
        }

        public MovieResource GetMovieByTitleSlug(string titleSlug)
        {
            if (!TryParseTitleSlug(titleSlug, out var tmdbId))
            {
                return null;
            }

            var context = BuildContext();
            var item = context.Items.FirstOrDefault((candidate) => candidate.Movie.TmdbId == tmdbId);

            if (item == null)
            {
                return null;
            }

            return MapResources(new List<MovieQueryItem> { item }, context).FirstOrDefault();
        }

        public MovieNavigationResource GetNavigation(string titleSlug)
        {
            if (!TryParseTitleSlug(titleSlug, out var tmdbId))
            {
                return null;
            }

            var context = BuildContext();
            var ordered = ApplySort(context.Items, DefaultSortKey, NzbDrone.Core.Datastore.SortDirection.Ascending);
            var index = ordered.FindIndex((item) => item.Movie.TmdbId == tmdbId);

            if (index < 0 || ordered.Count == 0)
            {
                return null;
            }

            var previous = ordered[(index - 1 + ordered.Count) % ordered.Count];
            var next = ordered[(index + 1) % ordered.Count];

            return new MovieNavigationResource
            {
                PreviousMovie = new MovieNavigationItemResource
                {
                    Title = previous.Title,
                    TitleSlug = previous.TitleSlug
                },
                NextMovie = new MovieNavigationItemResource
                {
                    Title = next.Title,
                    TitleSlug = next.TitleSlug
                }
            };
        }

        public List<MovieSearchResultResource> Search(string term, int limit = 20)
        {
            if (term.IsNullOrWhiteSpace())
            {
                return new List<MovieSearchResultResource>();
            }

            var context = BuildContext();
            var query = term.Trim();

            var results = context.Items
                .Select((item) => BuildSearchResult(item, context.TagLabels, query))
                .Where((result) => result != null)
                .OrderBy((result) => result.SortTitle, StringComparer.InvariantCultureIgnoreCase)
                .Take(limit)
                .ToList();

            return results;
        }

        private MovieIndexPagingRequestResource NormalizeRequest(MovieIndexPagingRequestResource request)
        {
            request ??= new MovieIndexPagingRequestResource();
            request.Page ??= 1;
            request.PageSize ??= 20;
            request.FilterKey ??= DefaultFilterKey;
            request.SortKey ??= DefaultSortKey;

            if (request.SortDirection == null || request.SortDirection == NzbDrone.Core.Datastore.SortDirection.Default)
            {
                request.SortDirection = NzbDrone.Core.Datastore.SortDirection.Ascending;
            }

            return request;
        }

        private MovieQueryContext BuildContext()
        {
            var language = (Language)_configService.MovieInfoLanguage;
            var translations = _movieTranslationService.GetAllTranslationsForLanguage(language)
                .GroupBy((translation) => translation.MovieMetadataId)
                .ToDictionary((group) => group.Key, (group) => group.First());
            var statistics = _movieStatisticsService.MovieStatistics()
                .ToDictionary((movieStat) => movieStat.MovieId);
            var rootFolders = _rootFolderService.All();
            var tagLabels = _tagService.All()
                .ToDictionary((tag) => tag.Id, (tag) => tag.Label);
            var items = _movieService.GetAllMovies()
                .Select((movie) =>
                {
                    statistics.TryGetValue(movie.Id, out var movieStatistics);
                    translations.TryGetValue(movie.MovieMetadataId, out var translation);

                    return new MovieQueryItem(movie, translation, movieStatistics ?? new MovieStatistics(), _configService.AvailabilityDelay);
                })
                .ToList();

            return new MovieQueryContext
            {
                RootFolders = rootFolders,
                Items = items,
                TagLabels = tagLabels
            };
        }

        private List<MovieResource> MapResources(List<MovieQueryItem> items, MovieQueryContext context)
        {
            var resources = new List<MovieResource>(items.Count);

            foreach (var item in items)
            {
                var resource = item.Movie.ToResource(
                    _configService.AvailabilityDelay,
                    item.Translation,
                    _qualityUpgradableSpecification);

                resource.Statistics = item.Statistics.ToResource();
                resource.HasFile = item.Statistics.MovieFileCount > 0;
                resource.SizeOnDisk = item.Statistics.SizeOnDisk;
                resource.RootFolderPath = _rootFolderService.GetBestRootFolderPath(resource.Path, context.RootFolders);

                _coverMapper.ConvertToLocalUrls(resource.Id, resource.Images);

                resources.Add(resource);
            }

            return resources;
        }

        private List<MovieQueryItem> ApplyFilters(
            List<MovieQueryItem> items,
            MovieIndexPagingRequestResource request,
            MovieQueryContext context)
        {
            var filters = GetBuiltInFilters(request.FilterKey);

            if (request.CustomFilterId.HasValue)
            {
                var customFilter = _customFilterService.Get(request.CustomFilterId.Value);
                filters = DeserializeCustomFilters(customFilter);
            }

            return items.Where((item) => filters.All((filter) => MatchesFilter(item, filter))).ToList();
        }

        private IEnumerable<MovieQueryFilter> GetBuiltInFilters(string filterKey)
        {
            switch ((filterKey ?? DefaultFilterKey).ToLowerInvariant())
            {
                case "monitored":
                    return new[] { new MovieQueryFilter("monitored", JToken.FromObject(true), "equal") };
                case "unmonitored":
                    return new[] { new MovieQueryFilter("monitored", JToken.FromObject(false), "equal") };
                case "missing":
                    return new[]
                    {
                        new MovieQueryFilter("monitored", JToken.FromObject(true), "equal"),
                        new MovieQueryFilter("hasFile", JToken.FromObject(false), "equal")
                    };
                case "wanted":
                    return new[]
                    {
                        new MovieQueryFilter("monitored", JToken.FromObject(true), "equal"),
                        new MovieQueryFilter("hasFile", JToken.FromObject(false), "equal"),
                        new MovieQueryFilter("isAvailable", JToken.FromObject(true), "equal")
                    };
                case "cutoffunmet":
                    return new[]
                    {
                        new MovieQueryFilter("monitored", JToken.FromObject(true), "equal"),
                        new MovieQueryFilter("hasFile", JToken.FromObject(true), "equal"),
                        new MovieQueryFilter("qualityCutoffNotMet", JToken.FromObject(true), "equal")
                    };
                default:
                    return Array.Empty<MovieQueryFilter>();
            }
        }

        private IEnumerable<MovieQueryFilter> DeserializeCustomFilters(CustomFilter customFilter)
        {
            if (customFilter?.Filters.IsNullOrWhiteSpace() != false)
            {
                return Array.Empty<MovieQueryFilter>();
            }

            return JArray.Parse(customFilter.Filters)
                .OfType<JObject>()
                .Select((token) => new MovieQueryFilter(
                    token.Value<string>("key"),
                    token["value"],
                    token.Value<string>("type") ?? "equal"))
                .ToList();
        }

        private bool MatchesFilter(MovieQueryItem item, MovieQueryFilter filter)
        {
            var type = (filter.Type ?? "equal").ToLowerInvariant();

            switch (filter.Key)
            {
                case "monitored":
                    return MatchScalar(item.Movie.Monitored, filter.Value, type);
                case "isAvailable":
                    return MatchScalar(item.IsAvailable, filter.Value, type);
                case "hasFile":
                    return MatchScalar(item.HasFile, filter.Value, type);
                case "minimumAvailability":
                    return MatchScalar(ToAvailabilityValue(item.Movie.MinimumAvailability), filter.Value, type);
                case "title":
                    return MatchString(item.Title, filter.Value, type);
                case "originalTitle":
                    return MatchString(item.Movie.MovieMetadata.Value.OriginalTitle, filter.Value, type);
                case "originalLanguage":
                    return MatchString(item.Movie.MovieMetadata.Value.OriginalLanguage?.Name, filter.Value, type);
                case "releaseGroups":
                    return MatchArray(item.Statistics.ReleaseGroups, filter.Value, type);
                case "status":
                    return MatchScalar(ToStatusValue(item.Movie.MovieMetadata.Value.Status), filter.Value, type);
                case "studio":
                    return MatchString(item.Movie.MovieMetadata.Value.Studio, filter.Value, type);
                case "collection":
                    return MatchString(item.Movie.MovieMetadata.Value.CollectionTitle, filter.Value, type);
                case "qualityProfileId":
                    return MatchScalar(item.Movie.QualityProfileId, filter.Value, type);
                case "added":
                    return MatchDate(item.Movie.Added, filter.Value, type);
                case "year":
                    return MatchScalar(item.Movie.Year, filter.Value, type);
                case "inCinemas":
                    return MatchDate(item.Movie.MovieMetadata.Value.InCinemas, filter.Value, type);
                case "physicalRelease":
                    return MatchDate(item.Movie.MovieMetadata.Value.PhysicalRelease, filter.Value, type);
                case "digitalRelease":
                    return MatchDate(item.Movie.MovieMetadata.Value.DigitalRelease, filter.Value, type);
                case "releaseDate":
                    return MatchDate(item.Movie.GetReleaseDate(), filter.Value, type);
                case "runtime":
                    return MatchScalar(item.Movie.MovieMetadata.Value.Runtime, filter.Value, type);
                case "path":
                    return MatchString(item.Movie.Path, filter.Value, type);
                case "sizeOnDisk":
                    return MatchScalar(item.Statistics.SizeOnDisk, filter.Value, type);
                case "genres":
                    return MatchArray(item.Movie.MovieMetadata.Value.Genres, filter.Value, type);
                case "keywords":
                    return MatchArray(item.Movie.MovieMetadata.Value.Keywords, filter.Value, type);
                case "tmdbRating":
                    return MatchScalar(item.Movie.MovieMetadata.Value.Ratings?.Tmdb?.Value * 10 ?? 0, filter.Value, type);
                case "tmdbVotes":
                    return MatchScalar(item.Movie.MovieMetadata.Value.Ratings?.Tmdb?.Votes ?? 0, filter.Value, type);
                case "imdbRating":
                    return MatchScalar(item.Movie.MovieMetadata.Value.Ratings?.Imdb?.Value ?? 0, filter.Value, type);
                case "imdbVotes":
                    return MatchScalar(item.Movie.MovieMetadata.Value.Ratings?.Imdb?.Votes ?? 0, filter.Value, type);
                case "rottenTomatoesRating":
                    return MatchScalar(item.Movie.MovieMetadata.Value.Ratings?.RottenTomatoes?.Value ?? 0, filter.Value, type);
                case "traktRating":
                    return MatchScalar(item.Movie.MovieMetadata.Value.Ratings?.Trakt?.Value * 10 ?? 0, filter.Value, type);
                case "traktVotes":
                    return MatchScalar(item.Movie.MovieMetadata.Value.Ratings?.Trakt?.Votes ?? 0, filter.Value, type);
                case "popularity":
                    return MatchScalar(item.Movie.MovieMetadata.Value.Popularity, filter.Value, type);
                case "certification":
                    return MatchString(item.Movie.MovieMetadata.Value.Certification, filter.Value, type);
                case "tags":
                    return MatchArray(item.Movie.Tags.Select((tag) => tag.ToString(CultureInfo.InvariantCulture)).ToList(), filter.Value, type);
                case "qualityCutoffNotMet":
                    return MatchScalar(
                        item.Movie.MovieFile != null &&
                        _qualityUpgradableSpecification.QualityCutoffNotMet(
                            item.Movie.QualityProfile,
                            item.Movie.MovieFile.Quality),
                        filter.Value,
                        type);
                default:
                    return true;
            }
        }

        private List<MovieQueryItem> ApplySort(
            List<MovieQueryItem> items,
            string sortKey,
            NzbDrone.Core.Datastore.SortDirection sortDirection)
        {
            IOrderedEnumerable<MovieQueryItem> ordered;
            var descending = sortDirection == NzbDrone.Core.Datastore.SortDirection.Descending;

            switch ((sortKey ?? DefaultSortKey).ToLowerInvariant())
            {
                case "status":
                    ordered = OrderBy(items, (item) => GetStatusSortValue(item), descending);
                    break;
                case "sorttitle":
                    ordered = OrderBy(items, (item) => item.SortTitle, descending, StringComparer.InvariantCultureIgnoreCase);
                    break;
                case "studio":
                    ordered = OrderBy(items, (item) => item.Movie.MovieMetadata.Value.Studio ?? string.Empty, descending, StringComparer.InvariantCultureIgnoreCase);
                    break;
                case "qualityprofileid":
                    ordered = OrderBy(items, (item) => item.Movie.QualityProfileId, descending);
                    break;
                case "added":
                    ordered = OrderBy(items, (item) => item.Movie.Added, descending);
                    break;
                case "year":
                    ordered = OrderBy(items, (item) => item.Movie.Year, descending);
                    break;
                case "incinemas":
                    ordered = OrderBy(items, (item) => item.Movie.MovieMetadata.Value.InCinemas ?? DateTime.MaxValue, descending);
                    break;
                case "digitalrelease":
                    ordered = OrderBy(items, (item) => item.Movie.MovieMetadata.Value.DigitalRelease ?? DateTime.MaxValue, descending);
                    break;
                case "physicalrelease":
                    ordered = OrderBy(items, (item) => item.Movie.MovieMetadata.Value.PhysicalRelease ?? DateTime.MaxValue, descending);
                    break;
                case "releasedate":
                    ordered = OrderBy(items, (item) => item.Movie.GetReleaseDate() ?? DateTime.MaxValue, descending);
                    break;
                case "tmdbrating":
                    ordered = OrderBy(items, (item) => item.Movie.MovieMetadata.Value.Ratings?.Tmdb?.Value ?? 0, descending);
                    break;
                case "imdbrating":
                    ordered = OrderBy(items, (item) => item.Movie.MovieMetadata.Value.Ratings?.Imdb?.Value ?? 0, descending);
                    break;
                case "rottentomatoesrating":
                    ordered = OrderBy(items, (item) => item.Movie.MovieMetadata.Value.Ratings?.RottenTomatoes?.Value ?? -1, descending);
                    break;
                case "traktrating":
                    ordered = OrderBy(items, (item) => item.Movie.MovieMetadata.Value.Ratings?.Trakt?.Value ?? 0, descending);
                    break;
                case "popularity":
                    ordered = OrderBy(items, (item) => item.Movie.MovieMetadata.Value.Popularity, descending);
                    break;
                case "path":
                    ordered = OrderBy(items, (item) => item.Movie.Path ?? string.Empty, descending, StringComparer.InvariantCultureIgnoreCase);
                    break;
                case "sizeondisk":
                    ordered = OrderBy(items, (item) => item.Statistics.SizeOnDisk, descending);
                    break;
                case "certification":
                    ordered = OrderBy(items, (item) => item.Movie.MovieMetadata.Value.Certification ?? string.Empty, descending, StringComparer.InvariantCultureIgnoreCase);
                    break;
                case "originaltitle":
                    ordered = OrderBy(items, (item) => item.Movie.MovieMetadata.Value.OriginalTitle ?? string.Empty, descending, StringComparer.InvariantCultureIgnoreCase);
                    break;
                case "originallanguage":
                    ordered = OrderBy(items, (item) => item.Movie.MovieMetadata.Value.OriginalLanguage?.Name ?? string.Empty, descending, StringComparer.InvariantCultureIgnoreCase);
                    break;
                case "tags":
                    ordered = OrderBy(items, (item) => string.Join("|", item.Movie.Tags.OrderBy((tag) => tag)), descending, StringComparer.InvariantCultureIgnoreCase);
                    break;
                case "collection":
                    ordered = OrderBy(items, (item) => item.Movie.MovieMetadata.Value.CollectionTitle ?? string.Empty, descending, StringComparer.InvariantCultureIgnoreCase);
                    break;
                case "runtime":
                    ordered = OrderBy(items, (item) => item.Movie.MovieMetadata.Value.Runtime, descending);
                    break;
                case "minimumavailability":
                    ordered = OrderBy(items, (item) => item.Movie.MinimumAvailability, descending);
                    break;
                case "releasestatus":
                case "moviestatus":
                    ordered = OrderBy(items, (item) => GetMovieStatusSortValue(item), descending);
                    break;
                case "releasegroups":
                    ordered = OrderBy(items, (item) => string.Join("|", item.Statistics.ReleaseGroups), descending, StringComparer.InvariantCultureIgnoreCase);
                    break;
                default:
                    ordered = OrderBy(items, (item) => item.SortTitle, descending, StringComparer.InvariantCultureIgnoreCase);
                    break;
            }

            return ordered
                .ThenBy((item) => item.SortTitle, StringComparer.InvariantCultureIgnoreCase)
                .ToList();
        }

        private static IOrderedEnumerable<MovieQueryItem> OrderBy<TKey>(
            IEnumerable<MovieQueryItem> items,
            Func<MovieQueryItem, TKey> selector,
            bool descending)
        {
            return descending ? items.OrderByDescending(selector) : items.OrderBy(selector);
        }

        private static IOrderedEnumerable<MovieQueryItem> OrderBy<TKey>(
            IEnumerable<MovieQueryItem> items,
            Func<MovieQueryItem, TKey> selector,
            bool descending,
            IComparer<TKey> comparer)
        {
            return descending ? items.OrderByDescending(selector, comparer) : items.OrderBy(selector, comparer);
        }

        private static int GetStatusSortValue(MovieQueryItem item)
        {
            var value = 0;

            if (item.Movie.Monitored)
            {
                value += 4;
            }

            switch (item.Movie.MovieMetadata.Value.Status)
            {
                case MovieStatusType.Announced:
                    value += 1;
                    break;
                case MovieStatusType.InCinemas:
                    value += 2;
                    break;
                case MovieStatusType.Released:
                    value += 3;
                    break;
            }

            return value;
        }

        private string GetMovieStatusSortValue(MovieQueryItem item)
        {
            var value = 0;
            var qualityName = string.Empty;

            if (item.IsAvailable)
            {
                value++;
            }

            if (item.Movie.Monitored)
            {
                value += 2;
            }

            if (item.Movie.MovieFile != null)
            {
                value += _qualityUpgradableSpecification.QualityCutoffNotMet(
                    item.Movie.QualityProfile,
                    item.Movie.MovieFile.Quality) ? 4 : 8;
                qualityName = item.Movie.MovieFile.Quality?.Quality?.Name ?? string.Empty;
            }

            return value.ToString("D2", CultureInfo.InvariantCulture) + qualityName;
        }

        private static bool MatchString(string itemValue, JToken filterValue, string type)
        {
            var value = filterValue?.ToString() ?? string.Empty;
            itemValue ??= string.Empty;

            switch (type)
            {
                case "contains":
                    return itemValue.ContainsIgnoreCase(value);
                case "notcontains":
                    return !itemValue.ContainsIgnoreCase(value);
                case "startswith":
                    return itemValue.StartsWith(value, StringComparison.InvariantCultureIgnoreCase);
                case "notstartswith":
                    return !itemValue.StartsWith(value, StringComparison.InvariantCultureIgnoreCase);
                case "endswith":
                    return itemValue.EndsWith(value, StringComparison.InvariantCultureIgnoreCase);
                case "notendswith":
                    return !itemValue.EndsWith(value, StringComparison.InvariantCultureIgnoreCase);
                case "equal":
                    return string.Equals(itemValue, value, StringComparison.InvariantCultureIgnoreCase);
                case "notequal":
                    return !string.Equals(itemValue, value, StringComparison.InvariantCultureIgnoreCase);
                default:
                    return false;
            }
        }

        private static bool MatchArray(IEnumerable<string> itemValues, JToken filterValue, string type)
        {
            var values = ToStringValues(filterValue);
            var itemList = itemValues?.ToList() ?? new List<string>();

            if (!values.Any())
            {
                return false;
            }

            if (type == "notcontains" || type == "notequal")
            {
                return values.All((value) => itemList.All((item) => !string.Equals(item, value, StringComparison.InvariantCultureIgnoreCase)));
            }

            return values.Any((value) => itemList.Any((item) => string.Equals(item, value, StringComparison.InvariantCultureIgnoreCase)));
        }

        private static bool MatchScalar<T>(T itemValue, JToken filterValue, string type)
            where T : IComparable
        {
            if (filterValue == null)
            {
                return false;
            }

            var values = filterValue is JArray
                ? filterValue.Values<T>().Cast<IComparable>().ToList()
                : new List<IComparable> { filterValue.ToObject<T>() };

            if (!values.Any())
            {
                return false;
            }

            if (type == "notcontains" || type == "notequal")
            {
                return values.All((value) => itemValue.CompareTo((T)value) != 0);
            }

            if (type == "contains" || type == "equal")
            {
                return values.Any((value) => itemValue.CompareTo((T)value) == 0);
            }

            var first = (T)values[0];

            switch (type)
            {
                case "greaterthan":
                    return itemValue.CompareTo(first) > 0;
                case "greaterthanorequal":
                    return itemValue.CompareTo(first) >= 0;
                case "lessthan":
                    return itemValue.CompareTo(first) < 0;
                case "lessthanorequal":
                    return itemValue.CompareTo(first) <= 0;
                default:
                    return false;
            }
        }

        private static bool MatchDate(DateTime? itemValue, JToken filterValue, string type)
        {
            if (!itemValue.HasValue)
            {
                return false;
            }

            if (type == "lessthan" || type == "greaterthan")
            {
                var filterDate = filterValue?.ToObject<DateTime?>()?.Date;

                if (!filterDate.HasValue)
                {
                    return false;
                }

                return type == "lessthan"
                    ? itemValue.Value.Date < filterDate.Value
                    : itemValue.Value.Date > filterDate.Value;
            }

            if (filterValue is not JObject rangeToken)
            {
                return false;
            }

            var unit = rangeToken.Value<string>("time");
            var value = rangeToken.Value<int?>("value") ?? 0;
            var now = DateTime.UtcNow;
            var target = unit switch
            {
                "days" => now.AddDays(value),
                "months" => now.AddMonths(value),
                "years" => now.AddYears(value),
                _ => now
            };

            return type switch
            {
                "inlast" => itemValue.Value >= target && itemValue.Value <= now,
                "notinlast" => itemValue.Value < target,
                "innext" => itemValue.Value >= now && itemValue.Value <= target,
                "notinnext" => itemValue.Value > target,
                _ => false
            };
        }

        private static List<string> ToStringValues(JToken token)
        {
            if (token is JArray array)
            {
                return array.Select((value) => value.ToString()).ToList();
            }

            if (token == null)
            {
                return new List<string>();
            }

            return new List<string> { token.ToString() };
        }

        private static string ToStatusValue(MovieStatusType status)
        {
            return status switch
            {
                MovieStatusType.TBA => "tba",
                MovieStatusType.Announced => "announced",
                MovieStatusType.InCinemas => "inCinemas",
                MovieStatusType.Released => "released",
                MovieStatusType.Deleted => "deleted",
                _ => status.ToString()
            };
        }

        private static string ToAvailabilityValue(MovieStatusType availability)
        {
            return availability switch
            {
                MovieStatusType.TBA => "tba",
                MovieStatusType.Announced => "announced",
                MovieStatusType.InCinemas => "inCinemas",
                MovieStatusType.Released => "released",
                _ => availability.ToString()
            };
        }

        private static bool TryParseTitleSlug(string titleSlug, out int tmdbId)
        {
            return int.TryParse(titleSlug, NumberStyles.Integer, CultureInfo.InvariantCulture, out tmdbId);
        }

        private static MovieSearchResultResource BuildSearchResult(
            MovieQueryItem item,
            Dictionary<int, string> tagLabels,
            string query)
        {
            if (item.Title.ContainsIgnoreCase(query))
            {
                return item.ToSearchResult("title", 0, tagLabels);
            }

            if ((item.Movie.MovieMetadata.Value.OriginalTitle ?? string.Empty).ContainsIgnoreCase(query))
            {
                return item.ToSearchResult("originalTitle", 0, tagLabels);
            }

            for (var i = 0; i < item.Movie.MovieMetadata.Value.AlternativeTitles.Count; i++)
            {
                if (item.Movie.MovieMetadata.Value.AlternativeTitles[i].Title.ContainsIgnoreCase(query))
                {
                    return item.ToSearchResult("alternateTitles.title", i, tagLabels);
                }
            }

            if (item.Movie.TmdbId.ToString(CultureInfo.InvariantCulture).Contains(query, StringComparison.InvariantCultureIgnoreCase))
            {
                return item.ToSearchResult("tmdbId", 0, tagLabels);
            }

            if ((item.Movie.ImdbId ?? string.Empty).ContainsIgnoreCase(query))
            {
                return item.ToSearchResult("imdbId", 0, tagLabels);
            }

            var tagIds = item.Movie.Tags.OrderBy((tagId) => tagId).ToList();

            for (var i = 0; i < tagIds.Count; i++)
            {
                var tagId = tagIds[i];

                if (tagLabels.TryGetValue(tagId, out var tagLabel) && tagLabel.ContainsIgnoreCase(query))
                {
                    return item.ToSearchResult("tags.label", i, tagLabels);
                }
            }

            return null;
        }

        private sealed class MovieQueryContext
        {
            public List<RootFolder> RootFolders { get; init; }
            public List<MovieQueryItem> Items { get; init; }
            public Dictionary<int, string> TagLabels { get; init; }
        }

        private sealed class MovieQueryFilter
        {
            public MovieQueryFilter(string key, JToken value, string type)
            {
                Key = key;
                Value = value;
                Type = type;
            }

            public string Key { get; }
            public JToken Value { get; }
            public string Type { get; }
        }

        private sealed class MovieQueryItem
        {
            public MovieQueryItem(Movie movie, MovieTranslation translation, MovieStatistics statistics, int availabilityDelay)
            {
                Movie = movie;
                Translation = translation;
                Statistics = statistics;
                Title = translation?.Title ?? movie.Title;
                SortTitle = MovieTitleNormalizer.Normalize(Title, movie.TmdbId);
                TitleSlug = movie.TmdbId.ToString(CultureInfo.InvariantCulture);
                IsAvailable = movie.IsAvailable(availabilityDelay);
                HasFile = statistics.MovieFileCount > 0;
            }

            public Movie Movie { get; }
            public MovieTranslation Translation { get; }
            public MovieStatistics Statistics { get; }
            public string Title { get; }
            public string SortTitle { get; }
            public string TitleSlug { get; }
            public bool IsAvailable { get; }
            public bool HasFile { get; }

            public MovieSearchResultResource ToSearchResult(
                string matchedKey,
                int matchedIndex,
                Dictionary<int, string> tagLabels)
            {
                return new MovieSearchResultResource
                {
                    Title = Title,
                    Year = Movie.Year,
                    TitleSlug = TitleSlug,
                    SortTitle = SortTitle,
                    Images = Movie.MovieMetadata.Value.Images.JsonClone(),
                    AlternateTitles = Movie.MovieMetadata.Value.AlternativeTitles.ToResource(),
                    TmdbId = Movie.TmdbId,
                    ImdbId = Movie.ImdbId,
                    Tags = Movie.Tags
                        .OrderBy((tagId) => tagId)
                        .Select((tagId) => new TagLookupResource
                        {
                            Id = tagId,
                            Label = tagLabels.TryGetValue(tagId, out var label)
                                ? label
                                : tagId.ToString(CultureInfo.InvariantCulture)
                        })
                        .ToList(),
                    MatchedKey = matchedKey,
                    MatchedIndex = matchedIndex
                };
            }
        }
    }
}
