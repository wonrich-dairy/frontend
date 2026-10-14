using System.Net.Http.Json;
using System.Text.Json;
using MySqlConnector;
using OpenQA.Selenium;

namespace Wonrich.Selenium.Tests;

/// <summary>
/// Scripted end-to-end scenario across two services and Kafka:
/// an analyst passes a batch in the client (SCRUM-23 screen), Quality Lab publishes
/// BatchCleared through its outbox (SCRUM-24), Traceability consumes it (SCRUM-131) and
/// the unified batch record shows the batch as Cleared with its Lab section (SCRUM-133).
/// </summary>
[Trait("Story", "SCRUM-24")]
[Trait("Story", "SCRUM-131")]
[Trait("Story", "SCRUM-133")]
[CaptureAfterTest]
public class DeterminationToTraceabilityTests : IClassFixture<Browser>
{
    private readonly Browser _browser;

    public DeterminationToTraceabilityTests(Browser browser) => _browser = browser;

    [DatabaseFact]
    public async Task Passing_a_batch_in_the_client_clears_it_in_traceability()
    {
        // Batch codes start with the production day of the year, as Traceability expects.
        var batchCode = $"{DateTime.UtcNow.DayOfYear}-FM-E2E{DateTime.UtcNow:HHmmss}";
        await PrepareBatchAsync(batchCode);

        // The analyst records the determination in the browser.
        _browser.SignIn("analyst");
        _browser.Open("/quality-lab/panels");
        var queueItem = _browser.Wait.Until(d =>
            d.FindElements(By.XPath($"//*[contains(@class,'ql-panel-screen__queue-item')][.//strong[text()='{batchCode}']]")).FirstOrDefault());
        ((IJavaScriptExecutor)_browser.Driver).ExecuteScript("arguments[0].scrollIntoView({block:'center'});", queueItem);
        queueItem!.Click();

        _browser.Wait.Until(d => d.FindElements(By.XPath("//button[normalize-space()='Pass']")).FirstOrDefault())!.Click();
        _browser.Driver.FindElement(By.XPath("//button[normalize-space()='Submit Pass Determination']")).Click();
        _browser.Wait.Until(d => d.FindElements(By.XPath("//*[normalize-space()='PASSED']")).Count > 0);
        _browser.Evidence("SCRUM-24-determination-passed");

        // Kafka carries BatchCleared to Traceability, which updates the batch record.
        var token = await Stack.TokenAsync("admin");
        using var traceability = Stack.Api(Stack.Traceability, token);
        string? status = null;
        JsonElement record = default;
        for (var attempt = 0; attempt < 30 && status != "Cleared"; attempt++)
        {
            await Task.Delay(1000);
            var response = await traceability.GetAsync($"/api/batches/{batchCode}");
            if (!response.IsSuccessStatusCode) continue;
            record = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
            status = record.GetProperty("status").GetString();
        }

        // Show the API answer in the browser too, as evidence.
        _browser.Driver.Navigate().GoToUrl($"{Stack.Traceability}/health");
        Assert.Equal("Cleared", status);
        var lab = record.GetProperty("checkpoints").EnumerateArray()
            .Single(c => c.GetProperty("checkpoint").GetString() == "Lab");
        Assert.Equal("Recorded", lab.GetProperty("state").GetString());
    }

    /// <summary>
    /// A batch with a passing panel and sensory evaluation in Quality Lab, awaiting the lab
    /// in Traceability.
    /// </summary>
    private static async Task PrepareBatchAsync(string batchCode)
    {
        var token = await Stack.TokenAsync("analyst");
        using var lab = Stack.Api(Stack.QualityLab, token);
        (await lab.PostAsJsonAsync("/api/panels/batch",
            new { batchCode, dispatchNumber = $"DN-{batchCode}", productLine = "FM", storingTankCode = "ST-E2E" })).EnsureSuccessStatusCode();
        (await lab.PostAsJsonAsync($"/api/panels/{batchCode}",
            new { fatPercent = 3.8, lactometerReading = 29.0, temperatureCelsius = 27.0, ph = 6.7 })).EnsureSuccessStatusCode();
        (await lab.PostAsJsonAsync($"/api/panels/{batchCode}/sensory",
            new { taste = "Acceptable", smell = "Acceptable", colour = "Acceptable", appearance = "Acceptable" })).EnsureSuccessStatusCode();

        await using var db = new MySqlConnection(Stack.TraceabilityDb!);
        await db.OpenAsync();
        await using var insert = db.CreateCommand();
        insert.CommandText = """
            INSERT INTO batch_records (BatchId, DispatchRef, ProductLine, Facility, Status, Completeness, FirstEventAt, LastEventAt)
            VALUES (@id, @dispatch, 'FM', 'FACTORY-E2E', 'AwaitingLab', 'Partial', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6))
            """;
        insert.Parameters.AddWithValue("@id", batchCode);
        insert.Parameters.AddWithValue("@dispatch", $"DN-{batchCode}");
        await insert.ExecuteNonQueryAsync();
    }
}
