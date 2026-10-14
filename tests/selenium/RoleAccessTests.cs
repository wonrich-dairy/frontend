using System.Net;
using OpenQA.Selenium;

namespace Wonrich.Selenium.Tests;

/// <summary>
/// SCRUM-129 negative role tests: a lab user cannot open the QCO dashboard, and an Intake
/// Officer cannot read historical lab results. Each is checked in the browser (the screen is
/// refused, not merely hidden) and at the API (403), since hiding a screen is not access control.
/// The seed has no separate Lab Technician account; the Quality Analyst is the lab role.
/// </summary>
[Trait("Story", "SCRUM-129")]
[CaptureAfterTest]
public class RoleAccessTests : IClassFixture<Browser>
{
    private readonly Browser _browser;

    public RoleAccessTests(Browser browser) => _browser = browser;

    private string Body => _browser.Driver.FindElement(By.TagName("body")).Text;

    [Fact]
    [Trait("Story", "SCRUM-136")]
    public void Lab_user_cannot_open_the_qco_dashboard()
    {
        _browser.SignIn("analyst");
        _browser.Open("/qco");

        _browser.Wait.Until(_ => Body.Contains("Not available to you"));
        _browser.Evidence("SCRUM-129-lab-user-refused-qco");
        Assert.DoesNotContain(_browser.Driver.FindElements(By.CssSelector(".panelhead__title")), e => e.Text == "Quality Dashboard");
    }

    [Fact]
    [Trait("Story", "SCRUM-135")]
    public async Task Lab_user_gets_403_from_the_dashboard_api()
    {
        using var api = Stack.Api(Stack.Traceability, await Stack.TokenAsync("analyst"));

        var response = await api.GetAsync("/api/dashboard/summary");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    [Trait("Story", "SCRUM-25")]
    public void Intake_officer_cannot_open_lab_history()
    {
        _browser.SignIn("officer");
        _browser.Open("/quality-lab/history");

        Thread.Sleep(2500);
        _browser.Evidence("SCRUM-129-intake-officer-lab-history");
        Assert.Empty(_browser.Driver.FindElements(By.CssSelector(".lab-history__table")));
    }

    [Fact]
    [Trait("Story", "SCRUM-25")]
    public async Task Intake_officer_gets_403_from_the_lab_results_api()
    {
        using var api = Stack.Api(Stack.QualityLab, await Stack.TokenAsync("officer"));

        var list = await api.GetAsync("/api/lab-results");
        var export = await api.GetAsync("/api/lab-results/export");

        Assert.Equal(HttpStatusCode.Forbidden, list.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, export.StatusCode);
    }
}
