using System.ComponentModel.DataAnnotations.Schema;
using ErpStore.Domain.Common;

namespace ErpStore.Domain.Entities;

public class CashRegisterSession : BaseEntity
{
    public int UserId { get; set; }
    public DateTime OpenTime { get; set; }
    public DateTime? CloseTime { get; set; }
    
    // Amounts
    public decimal OpenAmount { get; set; }
    public decimal CloseAmount { get; set; } // Physical count
    public decimal WithdrawalAmount { get; set; } // Amount withdrawn at session close
    [NotMapped]
    public decimal RemainingAmount => CloseAmount - WithdrawalAmount; // Base left for next opening
    public decimal CalculatedAmount { get; set; } // System expected
    [NotMapped]
    public decimal Discrepancy => CloseTime.HasValue ? CloseAmount - CalculatedAmount : 0;

    public string Status { get; set; } = "Open"; // Open, Closed
    public string? Notes { get; set; }

    // Relationship
    public User? User { get; set; }
}
