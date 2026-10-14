using System.Net.Http.Json;
using System.Text.Json;
using OpenQA.Selenium;

namespace Wonrich.Selenium.Tests;

/// <summary>
/// SCRUM-129 scripted scenario, from the lab onwards: a batch is tested with a deliberately low
/// fat reading (the injected deviation), the analyst fails it in the client, Quality Lab publishes
/// BatchFailed, Traceability marks the batch Failed, and the QC officer finds it on the dashboard
/// and runs the backward trace, which must name the Quality Lab checkpoint and the fat reading.
///
/// The chain before the lab (consignment, gate test, pour, dispatch, intake screening, processing)
/// cannot be driven end to end yet: a processing run stays AwaitingLabResult until the intake lab
/// panel (CF-1) exists. Until then the batch is seeded in Traceability, as in
/// <see cref="DeterminationToTraceabilityTests"/>.
/// </summary>
[Trait("Story", "SCRUM-129")]
[Trait("Story", "SCRUM-134")]
[Trait("Story", "SCRUM-137")]
[CaptureAfterTest]
public class FailedBatchTraceScenarioTests : IClassFixture<Browser>
{
    // Below the FM minimum, so the panel is out of spec at the fat parameter.
    private const decimal InjectedFatPercent = 2.90m;

    private readonly Browser _browser;

    public FailedBatchTraceScenarioTests(Browser browser) => _browser = browser;

    private string Body => _browser.Driver.FindElement(By.TagName("body")).Text;

    [DatabaseFact]
    public async Task A_lab_failure_is_found_on_the_dashboard_and_traced_to_the_lab()
    {
        var batchCode = $"{DateTime.UtcNow.DayOfYear}-FM-FAIL{DateTime.UtcNow:HHmmss}";
        await PrepareBatchAsync(batchCode);

        // The analyst fails the batch for low fat in the browser.
        _browser.SignIn("analyst");
        _browser.Open("/quality-lab/panels");
        var queueItem = _browser.Wait.Until(d =>
            d.FindElements(By.XPath($"//*[contains(@class,'ql-panel-screen__queue-item')][.//strong[text()='{batchCode}']]")).FirstOrDefault());
        ((IJavaScriptExecutor)_browser.Driver).ExecuteScript("arguments[0].scrollIntoView({block:'center'});", queueItem);
        queueItem!.Click();

        _browser.Wait.Until(d => d.FindElements(By.XPath("//button[normalize-space()='Fail']")).FirstOrDefault())!.Click();
        _browser.Wait.Until(d => d.FindElements(By.XPath("//button[contains(@class,'determination-form__reason-chip')][normalize-space()='Fat % below minimum']")).FirstOrDefault())!.Click();
        _browser.Driver.FindElement(By.XPath("//button[normalize-space()='Submit Fail Determination']")).Click();
        _browser.Wait.Until(d => d.FindElements(By.XPath("//*[normalize-space()='FAILED']")).Count > 0);
        _browser.Evidence("SCRUM-129-scenario-1-failed-in-lab");

        // Kafka carries BatchFailed to Traceability.
        await WaitForStatusAsync(batchCode, "Failed");

        // The QC officer sees it among the recent failures on the dashboard ...
        _browser.SignIn("admin");
        _browser.Open("/qco");
        _browser.Wait.Until(_ => Body.Contains(batchCode));
        _browser.Evidence("SCRUM-129-scenario-2-dashboard");

        // ... and the backward trace names the checkpoint where the deviation was injected.
        _browser.Open($"/qco/batches/{batchCode}/trace");
        _browser.Wait.Until(_ => Body.Contains("Chain, back from the lab", StringComparison.OrdinalIgnoreCase));
        _browser.Evidence("SCRUM-129-scenario-3-trace");

        var lead = _browser.Driver.FindElement(By.XPath("//*[contains(@class,'chain__step--first')]")).Text;
        Assert.StartsWith("Quality lab", lead.Trim(), StringComparison.OrdinalIgnoreCase);
        Assert.Contains("fat", lead, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("2.9", lead);
    }

    private static async Task WaitForStatusAsync(string batchCode, string expected)
    {
        using var traceability = Stack.Api(Stack.Traceability, await Stack.TokenAsync("admin"));
        string? status = null;
        for (var attempt = 0; attempt < 30 && status != expected; attempt++)
        {
            await Task.Delay(1000);
            var response = await traceability.GetAsync($"/api/batches/{batchCode}");
            if (!response.IsSuccessStatusCode) continue;
            status = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("status").GetString();
        }
        Assert.Equal(expected, status);
    }

    /// <summary>
    /// A batch in Quality Lab with the injected low-fat panel and a normal sensory evaluation,
    /// awaiting the lab in Traceability.
    /// </summary>
    private static async Task PrepareBatchAsync(string batchCode)
    {
        using var lab = Stack.Api(Stack.QualityLab, await Stack.TokenAsync("analyst"));
        (await lab.PostAsJsonAsync("/api/panels/batch",
            new { batchCode, dispatchNumber = $"DN-{batchCode}", productLine = "FM", storingTankCode = "ST-E2E" })).EnsureSuccessStatusCode();
        (await lab.PostAsJsonAsync($"/api/panels/{batchCode}",
            new { fatPercent = InjectedFatPercent, lactometerReading = 29.0, temperatureCelsius = 27.0, ph = 6.7 })).EnsureSuccessStatusCode();
        (await lab.PostAsJsonAsync($"/api/panels/{batchCode}/sensory",
            new { taste = "Acceptable", smell = "Acceptable", colour = "Acceptable", appearance = "Acceptable" })).EnsureSuccessStatusCode();

        await TraceabilitySeed.AwaitingLabAsync(batchCode);
    }
}
