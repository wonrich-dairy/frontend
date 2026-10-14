using OpenQA.Selenium;
using OpenQA.Selenium.Support.UI;

namespace Wonrich.Selenium.Tests;

/// <summary>
/// The QCO module in Chrome against the running Traceability Service: dashboard (SCRUM-136),
/// batch search, timeline and backward trace (SCRUM-137), and the batch filters with CSV
/// export (SCRUM-139). There is no seeded QC officer, so the System Administrator (the other
/// role the stories allow) is used, and the Quality Analyst is the role that must be refused.
/// </summary>
[CaptureAfterTest]
public class QcoScreensTests : IClassFixture<Browser>
{
    // A failed batch in the target environment (QCO_FAILED_BATCH; the local sample data has 262-FLM-A).
    private static string FailedBatch => Stack.FailedBatch;

    private readonly Browser _browser;

    public QcoScreensTests(Browser browser) => _browser = browser;

    private string Body => _browser.Driver.FindElement(By.TagName("body")).Text;

    [Fact]
    [Trait("Story", "SCRUM-136")]
    public void Dashboard_shows_panels_and_when_it_was_updated()
    {
        _browser.SignIn("admin");
        _browser.Open("/qco");

        _browser.Wait.Until(d => d.FindElements(By.CssSelector(".panelhead__title")).Any(e => e.Text == "Quality Dashboard"));
        _browser.Wait.Until(d => d.FindElements(By.CssSelector(".qcopanel")).Count > 0);
        _browser.Wait.Until(_ => Body.Contains("Last updated"));
        _browser.Evidence("SCRUM-136-dashboard");
        Assert.NotNull(_browser.Driver.FindElement(By.CssSelector("[aria-label='Dashboard filters']")));
    }

    [Fact]
    [Trait("Story", "SCRUM-136")]
    public void Dashboard_is_usable_at_360px()
    {
        _browser.SignIn("admin");
        _browser.Driver.Manage().Window.Size = new System.Drawing.Size(360, 800);
        try
        {
            _browser.Open("/qco");
            _browser.Wait.Until(d => d.FindElements(By.CssSelector(".qcopanel")).Count > 0);
            var scrollWidth = (long)((IJavaScriptExecutor)_browser.Driver).ExecuteScript("return document.documentElement.scrollWidth");
            var clientWidth = (long)((IJavaScriptExecutor)_browser.Driver).ExecuteScript("return document.documentElement.clientWidth");
            _browser.Evidence("SCRUM-136-dashboard-360");
            Assert.True(scrollWidth <= clientWidth + 1, $"page scrolls sideways at 360 px ({scrollWidth} > {clientWidth})");
        }
        finally
        {
            _browser.Driver.Manage().Window.Size = new System.Drawing.Size(1600, 1000);
        }
    }

    [Fact]
    [Trait("Story", "SCRUM-136")]
    [Trait("Story", "SCRUM-137")]
    public void Quality_analyst_is_refused_the_qco_module()
    {
        _browser.SignIn("analyst");
        _browser.Open("/qco");

        Thread.Sleep(2500);
        _browser.Evidence("SCRUM-136-analyst-refused");
        Assert.DoesNotContain(_browser.Driver.FindElements(By.CssSelector(".panelhead__title")), e => e.Text == "Quality Dashboard");

        _browser.Open($"/qco/batches/{FailedBatch}/trace");
        Thread.Sleep(2500);
        Assert.DoesNotContain("Chain, back from the lab", Body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    [Trait("Story", "SCRUM-137")]
    public void Search_opens_the_batch_timeline()
    {
        _browser.SignIn("admin");
        _browser.Open("/qco/batches");

        _browser.Wait.Until(d => d.FindElement(By.Id("batch-search"))).SendKeys(FailedBatch);
        _browser.Driver.FindElement(By.CssSelector("form[role=search] button[type=submit]")).Click();
        _browser.Wait.Until(_ => Body.Contains(FailedBatch));
        _browser.Evidence("SCRUM-137-search");

        _browser.Open($"/qco/batches/{FailedBatch}");
        _browser.Wait.Until(_ => Body.Contains("Timeline"));
        _browser.Evidence("SCRUM-137-timeline");
        Assert.Contains("Processing", Body);
    }

    [Fact]
    [Trait("Story", "SCRUM-137")]
    public void Unknown_batch_shows_a_clear_message()
    {
        _browser.SignIn("admin");
        _browser.Open("/qco/batches");

        _browser.Wait.Until(d => d.FindElement(By.Id("batch-search"))).SendKeys("999-FM-NOPE");
        _browser.Driver.FindElement(By.CssSelector("form[role=search] button[type=submit]")).Click();
        _browser.Wait.Until(d => d.FindElements(By.CssSelector("[role=status]")).Any(e => e.Text.Length > 0));
        Assert.DoesNotContain("error", _browser.Driver.FindElement(By.CssSelector("[role=status]")).Text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    [Trait("Story", "SCRUM-137")]
    public void Backward_trace_lists_the_chain_from_the_lab()
    {
        _browser.SignIn("admin");
        _browser.Open($"/qco/batches/{FailedBatch}/trace");

        // The section title is upper-cased by CSS, and Selenium reads the rendered text.
        _browser.Wait.Until(_ => Body.Contains("Chain, back from the lab", StringComparison.OrdinalIgnoreCase));
        var steps = _browser.Driver.FindElements(By.CssSelector("ol.chain > li"));
        _browser.Evidence("SCRUM-137-trace");
        Assert.Equal(4, steps.Count);
        Assert.StartsWith("Quality Lab", steps[0].Text.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    [Trait("Story", "SCRUM-139")]
    public void Filter_by_status_shows_a_count_and_offers_export()
    {
        _browser.SignIn("admin");
        _browser.Open("/qco/batches");

        var form = _browser.Wait.Until(d => d.FindElement(By.CssSelector("form[aria-label='Batch filters']")));
        new SelectElement(form.FindElements(By.TagName("select"))[0]).SelectByValue("Failed");
        form.FindElement(By.CssSelector("button[type=submit]")).Click();

        var count = _browser.Wait.Until(d => d.FindElements(By.CssSelector("[aria-label='Filtered batches'] .batchresults__count")).FirstOrDefault(e => e.Text.Length > 0));
        _browser.Evidence("SCRUM-139-filter-failed");
        Assert.Matches(@"\d", count!.Text);
        Assert.Contains(_browser.Driver.FindElements(By.TagName("button")), b => b.Text.Contains("to CSV"));
    }
}
