using MySqlConnector;

namespace Wonrich.Selenium.Tests;

/// <summary>
/// Puts a batch into the Traceability read model as Awaiting lab, the state the processing
/// consumer (SCRUM-130) leaves it in, for the scenarios that start at the lab. It also counts the
/// batch in the day's dashboard aggregate, as the consumer would: without that, the lab result
/// that follows takes the pending count below zero. Local stack only (TRACEABILITY_DB).
/// </summary>
public static class TraceabilitySeed
{
    public const string Facility = "FACTORY-E2E";

    public static async Task AwaitingLabAsync(string batchCode, string productLine = "FM")
    {
        await using var db = new MySqlConnection(Stack.TraceabilityDb!);
        await db.OpenAsync();
        await using var tx = await db.BeginTransactionAsync();

        await using (var batch = db.CreateCommand())
        {
            batch.Transaction = tx;
            batch.CommandText = """
                INSERT INTO batch_records (BatchId, DispatchRef, ProductLine, Facility, Status, Completeness, FirstEventAt, LastEventAt)
                VALUES (@id, @dispatch, @line, @facility, 'AwaitingLab', 'Partial', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6))
                """;
            batch.Parameters.AddWithValue("@id", batchCode);
            batch.Parameters.AddWithValue("@dispatch", $"DN-{batchCode}");
            batch.Parameters.AddWithValue("@line", productLine);
            batch.Parameters.AddWithValue("@facility", Facility);
            await batch.ExecuteNonQueryAsync();
        }

        await using (var aggregate = db.CreateCommand())
        {
            aggregate.Transaction = tx;
            aggregate.CommandText = """
                INSERT INTO daily_quality_aggregates
                    (Date, ProductLine, Facility, BatchCount, PendingCount, ClearedCount, FailedCount, OnHoldCount, DeviationCount, UpdatedAt)
                VALUES (@day, @line, @facility, 1, 1, 0, 0, 0, 0, UTC_TIMESTAMP(6))
                ON DUPLICATE KEY UPDATE BatchCount = BatchCount + 1, PendingCount = PendingCount + 1, UpdatedAt = UTC_TIMESTAMP(6)
                """;
            aggregate.Parameters.AddWithValue("@day", ProductionDay(batchCode).ToDateTime(TimeOnly.MinValue));
            aggregate.Parameters.AddWithValue("@line", productLine);
            aggregate.Parameters.AddWithValue("@facility", Facility);
            await aggregate.ExecuteNonQueryAsync();
        }

        await tx.CommitAsync();
    }

    // Traceability files a batch under the day of the year its code starts with (FactoryCalendar).
    private static DateOnly ProductionDay(string batchCode) =>
        new DateOnly(DateTime.UtcNow.Year, 1, 1).AddDays(int.Parse(batchCode.Split('-')[0]) - 1);
}
