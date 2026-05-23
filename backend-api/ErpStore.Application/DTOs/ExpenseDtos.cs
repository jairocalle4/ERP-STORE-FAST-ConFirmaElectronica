using System.ComponentModel.DataAnnotations;

namespace ErpStore.Application.DTOs;

public class ExpenseDto
{
    public int Id { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    
    public int ExpenseCategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    
    public DateTime Date { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public string? Notes { get; set; }
}

public class CreateExpenseDto
{
    [Required]
    public string Description { get; set; } = string.Empty;

    [Required]
    [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than 0")]
    public decimal Amount { get; set; }

    [Required]
    public int ExpenseCategoryId { get; set; }

    public DateTime Date { get; set; } = DateTime.Now;

    public string PaymentMethod { get; set; } = "Efectivo";
    public bool DeductFromCashRegister { get; set; } = false;

    public string? Notes { get; set; }
}

public class ExpenseCategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}

public class CreateExpenseCategoryDto
{
    [Required]
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
}
