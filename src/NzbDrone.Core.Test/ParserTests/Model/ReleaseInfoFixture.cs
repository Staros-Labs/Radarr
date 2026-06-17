using System;
using FluentAssertions;
using Newtonsoft.Json;
using NUnit.Framework;
using NzbDrone.Core.Parser.Model;
using STJsonSerializer = System.Text.Json.JsonSerializer;

namespace NzbDrone.Core.Test.ParserTests.Model
{
    [TestFixture]
    public class ReleaseInfoFixture
    {
        [Test]
        public void should_calculate_age_values_from_publish_date()
        {
            var release = new ReleaseInfo
            {
                PublishDate = DateTime.UtcNow.AddMinutes(-90)
            };

            release.Age.Should().Be(0);
            release.AgeHours.Should().BeApproximately(1.5, 0.05);
            release.AgeMinutes.Should().BeApproximately(90, 1);
        }

        [Test]
        public void should_deserialize_newtonsoft_payloads_with_age_fields()
        {
            var publishDate = DateTime.UtcNow.AddHours(-2);
            var json = $$"""
                         {
                           "PublishDate": "{{publishDate:O}}",
                           "Age": 999,
                           "AgeHours": 999,
                           "AgeMinutes": 999
                         }
                         """;

            var release = JsonConvert.DeserializeObject<ReleaseInfo>(json);

            release.Should().NotBeNull();
            release.Age.Should().Be(0);
            release.AgeHours.Should().BeApproximately(2, 0.05);
            release.AgeMinutes.Should().BeApproximately(120, 1);
        }

        [Test]
        public void should_deserialize_system_text_json_payloads_with_age_fields()
        {
            var publishDate = DateTime.UtcNow.AddHours(-3);
            var json = $$"""
                         {
                           "PublishDate": "{{publishDate:O}}",
                           "Age": 999,
                           "AgeHours": 999,
                           "AgeMinutes": 999
                         }
                         """;

            var release = STJsonSerializer.Deserialize<ReleaseInfo>(json);

            release.Should().NotBeNull();
            release.Age.Should().Be(0);
            release.AgeHours.Should().BeApproximately(3, 0.05);
            release.AgeMinutes.Should().BeApproximately(180, 1);
        }
    }
}
