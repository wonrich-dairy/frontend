using OpenQA.Selenium;

namespace Wonrich.Selenium.Tests;

/// <summary>
/// The Traceability Service in the browser: it is up and wired (SCRUM-119), its database is
/// migrated and reachable (SCRUM-120), and it documents the batch and dashboard APIs
/// (SCRUM-133, SCRUM-135). It has no client screens yet (SCRUM-136/137 are in progress).
/// </summary>
[CaptureAfterTest]
public class TraceabilityServiceTests : IClassFixture<Browser>
{
    private readonly Browser _browser;

    public TraceabilityServiceTests(Browser browser) => _browser = browser;

    [Fact]
    [Trait("Story", "SCRUM-119")]
    [Trait("Story", "SCRUM-120")]
    public void Health_page_reports_the_database_healthy()
    {
        _browser.Driver.Navigate().GoToUrl($"{Stack.Traceability}/health");

        var body = _browser.Driver.FindElement(By.TagName("body")).Text;
        _browser.Evidence("SCRUM-119-health");
        Assert.Contains("\"status\":\"Healthy\"", body);
        Assert.Contains("\"name\":\"mysql\",\"status\":\"Healthy\"", body);
    }

    [Theory]
    [Trait("Story", "SCRUM-133")]
    [Trait("Story", "SCRUM-135")]
    [Trait("Story", "SCRUM-125")]
    [InlineData("/api/batches/{batchId}")]
    [InlineData("/api/dashboard/summary")]
    [InlineData("/api/dashboard/trend")]
    [InlineData("/api/dashboard/failure-reasons")]
    [InlineData("/api/dashboard/recent-failures")]
    [InlineData("/api/dashboard/societies")]
    [InlineData("/api/batches/{batchId}/trace")]
    [InlineData("/api/batches/search")]
    [InlineData("/api/batches/export")]
    [InlineData("/api/audit")]
    [InlineData("/api/audit/coverage")]
    [InlineData("/api/admin/dead-letters")]
    [InlineData("/api/admin/rebuild")]
    public void Swagger_documents_the_endpoint(string path)
    {
        _browser.Driver.Navigate().GoToUrl($"{Stack.Traceability}/swagger/index.html");

        _browser.Wait.Until(d => d.FindElements(By.CssSelector(".opblock-summary-path")).Count > 0);
        var paths = _browser.Driver.FindElements(By.CssSelector(".opblock-summary-path")).Select(e => e.Text.Replace("​", "")).ToList();
        _browser.Evidence("SCRUM-135-swagger");
        Assert.Contains(path, paths);
    }
}
