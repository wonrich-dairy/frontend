using OpenQA.Selenium;
using OpenQA.Selenium.Support.UI;

namespace Wonrich.Selenium.Tests;

/// <summary>SCRUM-25: a quality analyst browses historical lab results in the client.</summary>
[Trait("Story", "SCRUM-25")]
[CaptureAfterTest]
public class LabHistoryTests : IClassFixture<Browser>
{
    private readonly Browser _browser;

    public LabHistoryTests(Browser browser)
    {
        _browser = browser;
        _browser.SignIn("analyst");
        _browser.Open("/quality-lab/history");
        WaitForResults();
    }

    private IWebDriver Driver => _browser.Driver;

    private void WaitForResults() =>
        _browser.Wait.Until(d => d.FindElements(By.CssSelector(".lab-history__table tbody tr")).Count > 0
                                 || d.FindElements(By.CssSelector(".lab-history__empty")).Count > 0);

    private void Apply()
    {
        Driver.FindElement(By.Id("lab-history-apply")).Click();
        Thread.Sleep(500); // let the old rows go before waiting for the new ones
        WaitForResults();
    }

    [Fact]
    public void Analyst_opens_lab_history_and_sees_results_and_summary()
    {
        var batches = Driver.FindElement(By.CssSelector(".lab-history__stat-value")).Text;
        var rows = Driver.FindElements(By.CssSelector(".lab-history__table tbody tr"));

        _browser.Evidence("SCRUM-25-lab-history");
        Assert.True(int.Parse(batches) > 0);
        Assert.NotEmpty(rows);
        Assert.Contains("page 1 of", Driver.FindElement(By.CssSelector(".lab-history__pager")).Text);
    }

    [Fact]
    public void Filtering_by_product_line_shows_only_that_line()
    {
        new SelectElement(Driver.FindElement(By.Id("lab-history-product-line"))).SelectByValue("SY");
        Apply();

        var lines = Driver.FindElements(By.CssSelector(".lab-history__table tbody .lab-history__chip")).Select(e => e.Text).ToList();
        _browser.Evidence("SCRUM-25-filter-SY");
        Assert.NotEmpty(lines);
        Assert.All(lines, line => Assert.Equal("SY", line));
    }

    [Fact]
    public void Filtering_by_failed_result_shows_only_failures()
    {
        new SelectElement(Driver.FindElement(By.Id("lab-history-result"))).SelectByValue("Fail");
        Apply();

        var results = Driver.FindElements(By.CssSelector(".lab-history__table tbody .lab-history__badge")).Select(e => e.Text).ToList();
        _browser.Evidence("SCRUM-25-filter-fail");
        Assert.NotEmpty(results);
        Assert.All(results, result => Assert.Equal("Fail", result));
    }

    [Fact]
    public void Choosing_pass_disables_the_failure_reason_filter()
    {
        new SelectElement(Driver.FindElement(By.Id("lab-history-result"))).SelectByValue("Pass");

        Assert.False(Driver.FindElement(By.Id("lab-history-reason")).Enabled);
    }

    [Fact]
    public void Export_csv_is_available_when_there_are_results()
    {
        Assert.True(Driver.FindElement(By.Id("lab-history-export")).Enabled);
    }
}
