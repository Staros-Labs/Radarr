using FluentAssertions;
using NUnit.Framework;
using NzbDrone.Core.MetadataSource.SkyHook;

namespace NzbDrone.Core.Test.MetadataSource.SkyHook
{
    [TestFixture]
    public class SkyHookProxyTitleNormalizationFixture
    {
        [TestCase("The Man from U.N.C.L.E.", "the man from u.n.c.l.e.")]
        [TestCase("R.I.P.D.", "r.i.p.d.")]
        public void should_preserve_meaningful_periods_when_normalizing_titles(string title, string expected)
        {
            SkyHookProxy.NormalizeSearchTitle(title).Should().Be(expected);
        }

        [TestCase("the man from u.n.c.l.e.", "the+man+from+u.n.c.l.e.")]
        [TestCase("r.i.p.d.", "r.i.p.d.")]
        [TestCase("movie_title", "movie+title")]
        public void should_only_replace_word_separators_when_building_search_terms(string title, string expected)
        {
            SkyHookProxy.BuildSearchTerm(title).Should().Be(expected);
        }
    }
}
