using ErpStore.Domain.Entities;
using ErpStore.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ErpStore.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/cash-register")]
public class CashRegisterController : ControllerBase
{
    private readonly AppDbContext _context;

    public CashRegisterController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("status")]
    public async Task<ActionResult<CashRegisterSession>> GetCurrentStatus()
    {
        var userId = GetCurrentUserId();
        // Check for any open session for the user (or system-wide if single terminal, but usually per user)
        var session = await _context.CashRegisterSessions
            .Where(s => s.UserId == userId && s.Status == "Open")
            .OrderByDescending(s => s.OpenTime)
            .FirstOrDefaultAsync();

        if (session == null) return NoContent();

        return session;
    }

    [HttpPost("open")]
    public async Task<ActionResult<CashRegisterSession>> OpenSession([FromBody] OpenSessionDto dto)
    {
        var userId = GetCurrentUserId();
        
        // Ensure no existing open session
        var existingSession = await _context.CashRegisterSessions
            .AnyAsync(s => s.UserId == userId && s.Status == "Open");
            
        if (existingSession) return BadRequest("Ya tienes una caja abierta.");

        var session = new CashRegisterSession
        {
            UserId = userId,
            OpenAmount = dto.Amount,
            OpenTime = DateTime.UtcNow,
            Status = "Open",
            CalculatedAmount = dto.Amount // Starts with open amount
        };

        _context.CashRegisterSessions.Add(session);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetCurrentStatus), session);
    }

    [HttpGet("summary")]
    public async Task<ActionResult<CashRegisterSummaryDto>> GetSummary()
    {
        var userId = GetCurrentUserId();
        var session = await _context.CashRegisterSessions
            .Where(s => s.UserId == userId && s.Status == "Open")
            .FirstOrDefaultAsync();

        if (session == null) return NotFound("No hay caja abierta.");

        // Calculate Cash Sales linked to this session
        var cashSales = await _context.Sales
            .Where(s => s.CashRegisterSessionId == session.Id && 
                        s.PaymentMethod == "Efectivo" &&
                        !s.IsVoid)
            .SumAsync(s => s.Total);

        // Calculate Cash Expenses linked to this session
        var expenses = await _context.Expenses
            .Where(e => e.CashRegisterSessionId == session.Id && e.PaymentMethod == "Efectivo")
            .SumAsync(e => e.Amount);

        // Calculate Manual Transactions
        var transactions = await _context.CashTransactions
            .Where(t => t.CashRegisterSessionId == session.Id)
            .ToListAsync();
            
        var manualIncome = transactions.Where(t => t.Type == "Income").Sum(t => t.Amount);
        var manualExpense = transactions.Where(t => t.Type == "Expense").Sum(t => t.Amount);

        var calculatedBalance = session.OpenAmount + cashSales + manualIncome - expenses - manualExpense;

        return new CashRegisterSummaryDto
        {
            SessionId = session.Id,
            OpenAmount = session.OpenAmount,
            CashSales = cashSales,
            Expenses = expenses,
            ManualIncome = manualIncome,
            ManualExpense = manualExpense,
            CalculatedBalance = calculatedBalance
        };
    }

    [HttpPost("close")]
    public async Task<IActionResult> CloseSession([FromBody] CloseSessionDto dto)
    {
        var userId = GetCurrentUserId();
        var session = await _context.CashRegisterSessions
            .Where(s => s.UserId == userId && s.Status == "Open")
            .FirstOrDefaultAsync();

        if (session == null) return BadRequest("No hay caja abierta para cerrar.");

        // Recalculate everything one last time to be sure
        var summary = (await GetSummary()).Value;
        
        session.CloseAmount = dto.CloseAmount;
        session.CalculatedAmount = summary.CalculatedBalance;
        session.CloseTime = DateTime.UtcNow;
        session.Status = "Closed";
        session.Notes = dto.Notes;

        _context.CashRegisterSessions.Update(session);
        await _context.SaveChangesAsync();

        return Ok(session);
    }

    [HttpPost("transaction")]
    public async Task<IActionResult> AddTransaction([FromBody] CashTransactionDto dto)
    {
         var userId = GetCurrentUserId();
        var session = await _context.CashRegisterSessions
            .Where(s => s.UserId == userId && s.Status == "Open")
            .FirstOrDefaultAsync();

        if (session == null) return BadRequest("Debe abrir caja antes de registrar movimientos.");

        var transaction = new CashTransaction
        {
             CashRegisterSessionId = session.Id,
             Type = dto.Type, // Income/Expense
             Amount = dto.Amount,
             Description = dto.Description,
             Date = DateTime.UtcNow
        };

        _context.CashTransactions.Add(transaction);
        await _context.SaveChangesAsync();
        return Ok(transaction);
    }
    
    [HttpGet("session/{id}/details")]
    public async Task<IActionResult> GetSessionDetails(int id)
    {
        var sessionDto = await _context.CashRegisterSessions
            .Where(s => s.Id == id)
            .Select(s => new {
                s.Id,
                s.Status,
                s.OpenAmount,
                s.CloseAmount,
                s.CalculatedAmount,
                s.Discrepancy,
                s.Notes,
                s.OpenTime,
                s.CloseTime,
                User = s.User == null ? null : new { s.User.Id, s.User.Username }
            })
            .FirstOrDefaultAsync();

        if (sessionDto == null) return NotFound("Sesión no encontrada.");

        var manualTransactions = await _context.CashTransactions
            .Where(t => t.CashRegisterSessionId == id)
            .OrderBy(t => t.Date)
            .Select(t => new { t.Id, t.Type, t.Amount, t.Description, t.Date })
            .ToListAsync();

        var sales = await _context.Sales
            .Where(s => s.CashRegisterSessionId == id && s.PaymentMethod == "Efectivo" && !s.IsVoid)
            .OrderBy(s => s.Date)
            .Select(s => new { s.Id, s.NoteNumber, s.Total, s.Date, s.Observation })
            .ToListAsync();

        var expenses = await _context.Expenses
            .Where(e => e.CashRegisterSessionId == id && e.PaymentMethod == "Efectivo")
            .OrderBy(e => e.Date)
            .Select(e => new { e.Id, e.Description, e.Amount, e.Date, e.Notes })
            .ToListAsync();

        return Ok(new { session = sessionDto, manualTransactions, sales, expenses });
    }

    /// <summary>
    /// Devuelve el detalle de movimientos de la sesión ACTIVA del usuario actual.
    /// Permite consultar ventas, egresos y movimientos sin cerrar la caja.
    /// </summary>
    [HttpGet("current/details")]
    public async Task<IActionResult> GetCurrentSessionDetails()
    {
        var userId = GetCurrentUserId();
        var sessionId = await _context.CashRegisterSessions
            .Where(s => s.UserId == userId && s.Status == "Open")
            .OrderByDescending(s => s.OpenTime)
            .Select(s => (int?)s.Id)
            .FirstOrDefaultAsync();

        if (sessionId == null) return NotFound("No hay caja abierta actualmente.");

        return await GetSessionDetails(sessionId.Value);
    }
    
    [HttpGet("debug-data")]
    public async Task<IActionResult> GetDebugData()
    {
        var sales = await _context.Sales.OrderByDescending(s => s.Id).Take(10).ToListAsync();
        var sessions = await _context.CashRegisterSessions.OrderByDescending(s => s.Id).Take(5).ToListAsync();
        return Ok(new { sales, sessions });
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory()
    {
        var sessions = await _context.CashRegisterSessions
            .OrderByDescending(s => s.OpenTime)
            .Take(50)
            .Select(s => new {
                s.Id,
                s.Status,
                s.OpenTime,
                s.CloseTime,
                s.OpenAmount,
                s.CloseAmount,
                s.CalculatedAmount,
                s.Discrepancy,
                s.Notes,
                s.UserId,
                User = s.User == null ? null : new { s.User.Id, s.User.Username }
            })
            .ToListAsync();

        return Ok(sessions);
    }

    private int GetCurrentUserId()
    {
        var claim = User.FindFirst("id")?.Value;
        if (int.TryParse(claim, out int id)) return id;
        return 0; // Should handle unauthorized better
    }
}

public record OpenSessionDto(decimal Amount);
public record CloseSessionDto(decimal CloseAmount, string? Notes);
public record CashTransactionDto(string Type, decimal Amount, string Description);
public record CashRegisterSummaryDto
{
    public int SessionId { get; set; }
    public decimal OpenAmount { get; set; }
    public decimal CashSales { get; set; }
    public decimal Expenses { get; set; }
    public decimal ManualIncome { get; set; }
    public decimal ManualExpense { get; set; }
    public decimal CalculatedBalance { get; set; }
}
