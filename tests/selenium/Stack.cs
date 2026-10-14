using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

// One Chrome at a time: tests share the signed-in browser of their class, and the
// after-test capture below reads the browser that is in use.
[assembly: CollectionBehavior(DisableTestParallelization = true)]

namespace Wonrich.Selenium.Tests;

/// <summary>
/// Where the stack under test is, and how to sign in. Everything comes from environment
/// variables, so no credential or staging URL lives in the source (SCRUM-129). In CI they are
/// the staging environment's secrets; locally the URLs default to the Docker stack. See README.md.
/// </summary>
public static class Stack
{
    public static string Frontend => Env("FRONTEND_URL", "http://localhost:5173");
    public static string Auth => Env("AUTH_API_URL", "http://localhost:5238");
    public static string QualityLab => Env("QUALITY_LAB_API_URL", "http://localhost:5069");
    public static string Traceability => Env("TRACEABILITY_API_URL", "http://localhost:5240");

    /// <summary>The password of the seeded accounts (admin, analyst, officer, ...).</summary>
    public static string Password =>
        Optional("SELENIUM_PASSWORD") ?? Optional("SEED_PASSWORD")
        ?? throw new InvalidOperationException("Set SELENIUM_PASSWORD to the password of the seeded test accounts.");

    /// <summary>
    /// Connection string to the Traceability database, for the scenario that seeds a batch
    /// directly. Not set in CI, where that scenario is skipped.
    /// </summary>
    public static string? TraceabilityDb => Optional("TRACEABILITY_DB");

    /// <summary>A failed batch present in the target environment, for the QCO screens.</summary>
    public static string FailedBatch => Env("QCO_FAILED_BATCH", "262-FLM-A");

    /// <summary>
    /// A new batch code for today's production day. Traceability files a batch under the day of
    /// the year its code starts with, in Colombo, so a UTC day would land on yesterday between
    /// 00:00 and 05:30 local time (SCRUM-148).
    /// </summary>
    public static string NewBatchCode(string infix)
    {
        var colombo = TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTime.UtcNow, "Asia/Colombo");
        return $"{colombo.DayOfYear}-FM-{infix}{colombo:HHmmss}";
    }

    /// <summary>
    /// The frontend's first page. When VERCEL_BYPASS_SECRET is set (Vercel Deployment Protection's
    /// "Protection Bypass for Automation" secret), it asks Vercel to set the bypass cookie, so the
    /// browser gets the app rather than the Vercel sign-in page. Without it, just the frontend.
    /// </summary>
    public static string FrontendEntry =>
        Optional("VERCEL_BYPASS_SECRET") is { } secret
            ? $"{Frontend}/?x-vercel-protection-bypass={Uri.EscapeDataString(secret)}&x-vercel-set-bypass-cookie=true"
            : Frontend;

    /// <summary>Folder for the per-test screenshot and browser console log; none when unset.</summary>
    public static string? ArtifactsDir => Optional("SELENIUM_ARTIFACTS");

    private static string? Optional(string name) =>
        Environment.GetEnvironmentVariable(name) is { Length: > 0 } value ? value : null;

    private static string Env(string name, string fallback) => (Optional(name) ?? fallback).TrimEnd('/');

    public static async Task<string> TokenAsync(string user)
    {
        using var http = new HttpClient();
        var response = await http.PostAsJsonAsync($"{Auth}/api/auth/login", new { username = user, password = Password });
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return json.RootElement.GetProperty("accessToken").GetString()!;
    }

    public static HttpClient Api(string baseUrl, string token)
    {
        var http = new HttpClient { BaseAddress = new Uri(baseUrl) };
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return http;
    }
}

/// <summary>One Chrome per test class. Headless unless SELENIUM_HEADED=1.</summary>
public sealed class Browser : IDisposable
{
    /// <summary>The browser of the running test class, for <see cref="CaptureAfterTestAttribute"/>.</summary>
    public static Browser? Current { get; private set; }

    public ChromeDriver Driver { get; }
    public WebDriverWait Wait { get; }

    public Browser()
    {
        var options = new ChromeOptions();
        if (Environment.GetEnvironmentVariable("SELENIUM_HEADED") != "1")
        {
            options.AddArgument("--headless=new");
        }
        options.AddArgument("--window-size=1600,1000");
        options.AddArgument("--no-sandbox");
        options.AddArgument("--disable-dev-shm-usage");
        options.SetLoggingPreference(LogType.Browser, LogLevel.All);
        Driver = new ChromeDriver(options);
        Wait = new WebDriverWait(Driver, TimeSpan.FromSeconds(20));
        Current = this;
    }

    public void SignIn(string user)
    {
        Current = this;
        Driver.Manage().Cookies.DeleteAllCookies();
        // The first load after clearing cookies sets the Vercel bypass cookie again, when there is one.
        Driver.Navigate().GoToUrl(Stack.FrontendEntry);
        ((IJavaScriptExecutor)Driver).ExecuteScript("localStorage.clear(); sessionStorage.clear();");
        Driver.Navigate().Refresh();

        Wait.Until(d => d.FindElement(By.Id("signin-username"))).SendKeys(user);
        Driver.FindElement(By.Id("signin-password")).SendKeys(Stack.Password);
        Driver.FindElement(By.CssSelector("button[type=submit]")).Click();
        Wait.Until(d => d.FindElements(By.Id("signin-username")).Count == 0);
    }

    public void Open(string path) => Driver.Navigate().GoToUrl($"{Stack.Frontend}{path}");

    /// <summary>Saves the current window as evidence, under SELENIUM_SCREENSHOTS if it is set.</summary>
    public void Evidence(string name)
    {
        var folder = Environment.GetEnvironmentVariable("SELENIUM_SCREENSHOTS");
        if (string.IsNullOrEmpty(folder)) return;
        Directory.CreateDirectory(folder);
        Driver.GetScreenshot().SaveAsFile(Path.Combine(folder, $"{name}.png"));
    }

    /// <summary>
    /// Saves a screenshot and the browser console log under SELENIUM_ARTIFACTS. Called after every
    /// test, so a failing test always leaves both behind. Never throws: a capture problem must not
    /// hide the test's own result.
    /// </summary>
    public void Capture(string name)
    {
        if (Stack.ArtifactsDir is not { } folder) return;
        try
        {
            Directory.CreateDirectory(folder);
            Driver.GetScreenshot().SaveAsFile(Path.Combine(folder, $"{name}.png"));
            var log = Driver.Manage().Logs.GetLog(LogType.Browser)
                .Select(e => $"{e.Timestamp:O} {e.Level} {e.Message}");
            File.WriteAllLines(Path.Combine(folder, $"{name}.console.log"), [$"URL: {Driver.Url}", .. log]);
        }
        catch (Exception e)
        {
            File.WriteAllText(Path.Combine(folder, $"{name}.capture-error.txt"), e.ToString());
        }
    }

    public void Dispose()
    {
        if (Current == this) Current = null;
        Driver.Quit();
    }
}

/// <summary>After each test of the class, saves its screenshot and browser console log.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class CaptureAfterTestAttribute : Xunit.Sdk.BeforeAfterTestAttribute
{
    public override void After(System.Reflection.MethodInfo methodUnderTest) =>
        Browser.Current?.Capture($"{methodUnderTest.DeclaringType?.Name}.{methodUnderTest.Name}");
}

/// <summary>A test that seeds data straight into the Traceability database; skipped when TRACEABILITY_DB is not set (CI).</summary>
public sealed class DatabaseFactAttribute : FactAttribute
{
    public DatabaseFactAttribute()
    {
        if (Stack.TraceabilityDb is null)
        {
            Skip = "Needs TRACEABILITY_DB: seeds a batch directly in the Traceability database (local stack only).";
        }
    }
}
