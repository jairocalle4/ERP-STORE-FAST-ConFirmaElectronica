using Npgsql;

var connString = "Host=ep-blue-firefly-ait5ft4m.c-4.us-east-1.aws.neon.tech;Database=neondb;Username=neondb_owner;Password=npg_e2cg4MKubLUS;Ssl Mode=Require;Trust Server Certificate=true";

await using var conn = new NpgsqlConnection(connString);
await conn.OpenAsync();

Console.WriteLine("=== TODAS LAS VENTAS ===");
await using var cmdFinal = new NpgsqlCommand(@"
    SELECT s.""Id"", s.""NoteNumber"", s.""Total"", s.""IsVoid"", s.""IsElectronic"", 
           s.""ElectronicStatus"", s.""SriErrorMessage"", s.""Date"", c.""Name""
    FROM ""Sales"" s
    LEFT JOIN ""Clients"" c ON s.""ClientId"" = c.""Id""
    ORDER BY s.""Id"" DESC
", conn);

await using var readerFinal = await cmdFinal.ExecuteReaderAsync();
Console.WriteLine($"{"ID",-5} {"NoteNumber",-22} {"Status",-12} {"Error"}");
Console.WriteLine(new string('-', 100));
while (await readerFinal.ReadAsync())
{
    var id = readerFinal.GetInt32(0);
    var note = readerFinal.IsDBNull(1) ? "(null)" : readerFinal.GetString(1);
    var status = readerFinal.IsDBNull(5) ? "(null)" : readerFinal.GetString(5);
    var err = readerFinal.IsDBNull(6) ? "" : readerFinal.GetString(6);
    Console.WriteLine($"{id,-5} {note,-22} {status,-12} {err}");
}
await readerFinal.CloseAsync();
