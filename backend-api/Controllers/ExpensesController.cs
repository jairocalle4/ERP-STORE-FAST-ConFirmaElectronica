using ErpStore.Application.DTOs;
using ErpStore.Domain.Entities;
using ErpStore.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ErpStore.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/expenses")]
public class ExpensesController : ControllerBase
{
    private readonly AppDbContext _context;

    public ExpensesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResponse<ExpenseDto>>> GetExpenses([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _context.Expenses
            .Include(e => e.ExpenseCategory)
            .OrderByDescending(e => e.Date);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new ExpenseDto
            {
                Id = e.Id,
                Description = e.Description,
                Amount = e.Amount,
                ExpenseCategoryId = e.ExpenseCategoryId,
                CategoryName = e.ExpenseCategory != null ? e.ExpenseCategory.Name : "Sin Categoría",
                Date = e.Date,
                PaymentMethod = e.PaymentMethod,
                Notes = e.Notes
            }).ToListAsync();

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
        return new PagedResponse<ExpenseDto>(items, totalCount, page, pageSize, totalPages);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ExpenseDto>> GetExpense(int id)
    {
        var expense = await _context.Expenses
            .Include(e => e.ExpenseCategory)
            .FirstOrDefaultAsync(e => e.Id == id);
            
        if (expense == null) return NotFound();

        return new ExpenseDto
        {
            Id = expense.Id,
            Description = expense.Description,
            Amount = expense.Amount,
            ExpenseCategoryId = expense.ExpenseCategoryId,
            CategoryName = expense.ExpenseCategory?.Name ?? "Sin Categoría",
            Date = expense.Date,
            PaymentMethod = expense.PaymentMethod,
            Notes = expense.Notes
        };
    }

    [HttpPost]
    public async Task<ActionResult<Expense>> CreateExpense(CreateExpenseDto dto)
    {
        var categoryExists = await _context.ExpenseCategories.AnyAsync(c => c.Id == dto.ExpenseCategoryId);
        if (!categoryExists)
        {
            return BadRequest("Categoría inválida.");
        }

        var userId = GetCurrentUserId();
        int? activeSessionId = null;

        // ENFORCE CASH REGISTER SESSION FOR CASH EXPENSES
        if (dto.PaymentMethod == "Efectivo" && dto.DeductFromCashRegister)
        {
            var session = await _context.CashRegisterSessions
                .FirstOrDefaultAsync(s => s.UserId == userId && s.Status == "Open");

            if (session == null)
            {
                return BadRequest("NO_OPEN_SESSION: Debe abrir caja antes de registrar egresos de Efectivo (Caja Chica).");
            }
            activeSessionId = session.Id;
        }

        var expense = new Expense
        {
            Description = dto.Description,
            Amount = dto.Amount,
            ExpenseCategoryId = dto.ExpenseCategoryId,
            Date = dto.Date,
            PaymentMethod = dto.PaymentMethod,
            Notes = dto.Notes,
            CreatedAt = DateTime.UtcNow,
            CashRegisterSessionId = activeSessionId
        };

        _context.Expenses.Add(expense);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetExpense), new { id = expense.Id }, expense);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateExpense(int id, CreateExpenseDto dto)
    {
        var expense = await _context.Expenses.FindAsync(id);
        if (expense == null) return NotFound();

        var categoryExists = await _context.ExpenseCategories.AnyAsync(c => c.Id == dto.ExpenseCategoryId);
        if (!categoryExists)
        {
            return BadRequest("Categoría inválida.");
        }

        expense.Description = dto.Description;
        expense.Amount = dto.Amount;
        expense.ExpenseCategoryId = dto.ExpenseCategoryId;
        expense.Date = dto.Date;
        expense.PaymentMethod = dto.PaymentMethod;
        expense.Notes = dto.Notes;
        
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteExpense(int id)
    {
        var expense = await _context.Expenses.FindAsync(id);
        if (expense == null) return NotFound();

        _context.Expenses.Remove(expense);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private int GetCurrentUserId()
    {
        var claim = User.FindFirst("id")?.Value;
        if (int.TryParse(claim, out int id)) return id;
        return 0;
    }
}
