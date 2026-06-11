using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ErpStore.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddElectronicSignatureFile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "ElectronicSignatureFile",
                table: "CompanySettings",
                type: "bytea",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ElectronicSignatureFile",
                table: "CompanySettings");
        }
    }
}
