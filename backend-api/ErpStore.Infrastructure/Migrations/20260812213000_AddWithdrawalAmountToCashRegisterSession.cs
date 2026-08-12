using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ErpStore.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWithdrawalAmountToCashRegisterSession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE ""CashRegisterSessions""
                ADD COLUMN IF NOT EXISTS ""WithdrawalAmount"" DECIMAL(18,2) NOT NULL DEFAULT 0;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE ""CashRegisterSessions""
                DROP COLUMN IF EXISTS ""WithdrawalAmount"";
            ");
        }
    }
}
