using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ErpStore.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCashRegisterTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Create CashRegisterSessions table if not exists
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS ""CashRegisterSessions"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""UserId"" INTEGER NOT NULL,
                    ""OpenTime"" TIMESTAMP NOT NULL,
                    ""CloseTime"" TIMESTAMP NULL,
                    ""OpenAmount"" DECIMAL(18,2) NOT NULL DEFAULT 0,
                    ""CloseAmount"" DECIMAL(18,2) NOT NULL DEFAULT 0,
                    ""CalculatedAmount"" DECIMAL(18,2) NOT NULL DEFAULT 0,
                    ""Status"" VARCHAR(20) NOT NULL DEFAULT 'Open',
                    ""Notes"" TEXT NULL,
                    ""IsActive"" BOOLEAN NOT NULL DEFAULT TRUE,
                    ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT NOW()
                );
            ");

            // Create CashTransactions table if not exists
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS ""CashTransactions"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""CashRegisterSessionId"" INTEGER NOT NULL,
                    ""Type"" VARCHAR(20) NOT NULL DEFAULT 'Income',
                    ""Amount"" DECIMAL(18,2) NOT NULL,
                    ""Description"" TEXT NOT NULL DEFAULT '',
                    ""Date"" TIMESTAMP NOT NULL DEFAULT NOW(),
                    ""ReferenceId"" INTEGER NULL,
                    ""ReferenceType"" VARCHAR(50) NULL,
                    ""IsActive"" BOOLEAN NOT NULL DEFAULT TRUE,
                    ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT NOW()
                );
            ");

            // Add CashRegisterSessionId to Sales if column doesn't exist
            migrationBuilder.Sql(@"
                ALTER TABLE ""Sales""
                ADD COLUMN IF NOT EXISTS ""CashRegisterSessionId"" INTEGER NULL;
            ");

            // Add CashRegisterSessionId to Expenses if column doesn't exist
            migrationBuilder.Sql(@"
                ALTER TABLE ""Expenses""
                ADD COLUMN IF NOT EXISTS ""CashRegisterSessionId"" INTEGER NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS ""CashTransactions"";");
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS ""CashRegisterSessions"";");
            migrationBuilder.Sql(@"ALTER TABLE ""Sales"" DROP COLUMN IF EXISTS ""CashRegisterSessionId"";");
            migrationBuilder.Sql(@"ALTER TABLE ""Expenses"" DROP COLUMN IF EXISTS ""CashRegisterSessionId"";");
        }
    }
}
