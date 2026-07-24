using ErpStore.Application.DTOs;
using ErpStore.Domain.Entities;
using ErpStore.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace ErpStore.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/reports")]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<ReportsController> _logger;

    public ReportsController(AppDbContext context, ILogger<ReportsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet("kpi-stats")]
    public async Task<ActionResult<KpiStatsDto>> GetKpiStats([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
    {
        try 
        {
            var start = startDate ?? DateTime.MinValue;
            var end = endDate?.AddDays(1).AddTicks(-1) ?? DateTime.MaxValue;

            // Proyección directa: la BD calcula los totales, no se cargan entidades completas a RAM
            var salesData = await _context.Sales
                .Where(s => !s.IsVoid && s.Date >= start && s.Date <= end)
                .Select(s => new {
                    s.Total,
                    CostTotal = s.SaleDetails.Sum(sd => (sd.Product != null ? sd.Product.Cost : 0) * sd.Quantity)
                })
                .AsNoTracking()
                .ToListAsync();

            var expenses = await _context.Expenses
                .Where(e => e.Date >= start && e.Date <= end)
                .SumAsync(e => (decimal?)e.Amount) ?? 0;

            // Transacciones manuales de caja (ej. copias, servicios pequeños, egresos de caja)
            var manualTransactions = await _context.CashTransactions
                .Where(t => t.Date >= start && t.Date <= end)
                .AsNoTracking()
                .ToListAsync();

            var manualIncome = manualTransactions.Where(t => t.Type == "Income").Sum(t => t.Amount);
            var manualExpense = manualTransactions.Where(t => t.Type == "Expense").Sum(t => t.Amount);

            var totalRevenue = salesData.Sum(s => s.Total) + manualIncome;
            var totalCost = salesData.Sum(s => s.CostTotal);

            var grossProfit = totalRevenue - totalCost;
            var totalExpenses = expenses + manualExpense;
            var netProfit = grossProfit - totalExpenses;

            return new KpiStatsDto
            {
                TotalRevenue = totalRevenue,
                TotalCost = totalCost,
                GrossProfit = grossProfit,
                TotalExpenses = totalExpenses,
                NetProfit = netProfit,
                TotalTransactions = salesData.Count,
                AverageTicket = salesData.Count > 0 ? salesData.Sum(s => s.Total) / salesData.Count : 0
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting KPI stats");
            return StatusCode(500, "Internal Server Error during KPI calculation");
        }
    }

    [HttpGet("sales-trend")]
    public async Task<ActionResult<IEnumerable<SalesTrendDto>>> GetSalesTrend([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
    {
        try
        {
            var start = startDate ?? DateTime.UtcNow.AddMonths(-6);
             // Ensure end date covers the full day
            var end = endDate?.Date.AddDays(1).AddTicks(-1) ?? DateTime.UtcNow;

            // Group by Day
            var salesData = await _context.Sales
                .Where(s => !s.IsVoid && s.Date >= start && s.Date <= end)
                .GroupBy(s => s.Date.Date)
                .Select(g => new { Date = g.Key, Revenue = g.Sum(s => s.Total) })
                .AsNoTracking()
                .ToListAsync();

            var expensesData = await _context.Expenses
                .Where(e => e.Date >= start && e.Date <= end)
                .GroupBy(e => e.Date.Date)
                .Select(g => new { Date = g.Key, Expense = g.Sum(e => e.Amount) })
                .AsNoTracking()
                .ToListAsync();

            var manualData = await _context.CashTransactions
                .Where(t => t.Date >= start && t.Date <= end)
                .GroupBy(t => t.Date.Date)
                .Select(g => new { 
                    Date = g.Key, 
                    Income = g.Where(t => t.Type == "Income").Sum(t => t.Amount),
                    Expense = g.Where(t => t.Type == "Expense").Sum(t => t.Amount)
                })
                .AsNoTracking()
                .ToListAsync();

            var allDates = salesData.Select(s => s.Date)
                .Union(expensesData.Select(e => e.Date))
                .Union(manualData.Select(m => m.Date))
                .Distinct()
                .OrderBy(d => d)
                .ToList();

            var trendList = allDates.Select(date => {
                var s = salesData.FirstOrDefault(x => x.Date == date);
                var e = expensesData.FirstOrDefault(x => x.Date == date);
                var m = manualData.FirstOrDefault(x => x.Date == date);

                var rev = (s?.Revenue ?? 0) + (m?.Income ?? 0);
                var exp = (e?.Expense ?? 0) + (m?.Expense ?? 0);

                return new SalesTrendDto
                {
                    Date = date,
                    Period = date.ToString("dd MMM", new CultureInfo("es-EC")),
                    Revenue = rev,
                    Expenses = exp,
                    NetProfit = rev - exp
                };
            });

            return Ok(trendList);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting sales trend");
            return StatusCode(500, "Internal Server Error");
        }
    }

    [HttpGet("top-products")]
    public async Task<ActionResult<IEnumerable<TopProductDto>>> GetTopProducts([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
    {
        try
        {
            var start = startDate ?? DateTime.MinValue;
            var end = endDate?.AddDays(1).AddTicks(-1) ?? DateTime.MaxValue;

            var query = _context.SaleDetails
                .Include(sd => sd.Sale)
                .Include(sd => sd.Product)
                .Where(sd => !sd.Sale.IsVoid && sd.Sale.Date >= start && sd.Sale.Date <= end);

            // Using pure projection to avoid Include null issues if possible
            // But GroupBy in EF Core sometimes needs care. client evaluation involved?
            // SQLite restriction on GroupBy? 
            // Lets fetch first then group in memory for safety with SQLite
            
            var details = await query.AsNoTracking().ToListAsync();

            return details
                .GroupBy(sd => sd.Product?.Name ?? "N/A")
                .Select(g => new TopProductDto
                {
                    ProductName = g.Key,
                    QuantitySold = g.Sum(sd => sd.Quantity),
                    TotalRevenue = g.Sum(sd => sd.Subtotal)
                })
                .OrderByDescending(x => x.TotalRevenue)
                .Take(5)
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting top products");
             return StatusCode(500, "Internal Server Error during Top Products calculation");
        }
    }

    [HttpGet("inventory-valuation")]
    public async Task<ActionResult<IEnumerable<InventoryValuationDto>>> GetInventoryValuation()
    {
        try
        {
            var query = _context.Products
                .Where(p => p.IsActive)
                .Include(p => p.Category);
            
            var products = await query.AsNoTracking().ToListAsync();

            var grouped = products
                .GroupBy(p => p.Category?.Name ?? "Sin Categoría")
                .Select(g => new InventoryValuationDto
                {
                    CategoryName = g.Key,
                    ProductCount = g.Count(),
                    TotalValue = g.Sum(p => p.Cost * p.Stock) 
                })
                .ToList();

            var grandTotal = grouped.Sum(i => i.TotalValue);
            foreach (var item in grouped)
            {
                item.Percentage = grandTotal > 0 ? (item.TotalValue / grandTotal) * 100 : 0;
            }

            return grouped.OrderByDescending(i => i.TotalValue).ToList();
        }
        catch (Exception ex)
        {
             _logger.LogError(ex, "Error getting inventory valuation");
             return StatusCode(500, "Internal Server Error during Inventory Valuation");
        }
    }

    [HttpGet("sales-profit")]
    public async Task<ActionResult<IEnumerable<SaleProfitDto>>> GetSalesProfit([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
    {
        try
        {
            var start = startDate ?? DateTime.MinValue;
            var end = endDate?.AddDays(1).AddTicks(-1) ?? DateTime.MaxValue;

            // Fetch with AsNoTracking for performance
            // Proyección directa: solo traer los campos necesarios, no entidades completas
            var details = await _context.SaleDetails
                .Where(sd => !sd.Sale.IsVoid && sd.Sale.Date >= start && sd.Sale.Date <= end)
                .OrderByDescending(sd => sd.Sale.Date)
                .Select(sd => new SaleProfitDto
                {
                    SaleId = sd.SaleId,
                    NoteNumber = sd.Sale.NoteNumber ?? $"N-{sd.SaleId}",
                    Date = sd.Sale.Date,
                    EmployeeName = sd.Sale.Employee != null ? sd.Sale.Employee.Name : "Desconocido",
                    ProductNames = sd.Product != null ? sd.Product.Name : "Producto Eliminado",
                    TotalQuantity = sd.Quantity,
                    TotalRevenue = sd.Subtotal,
                    TotalCost = (sd.Product != null ? sd.Product.Cost : 0) * sd.Quantity,
                    GrossProfit = sd.Subtotal - ((sd.Product != null ? sd.Product.Cost : 0) * sd.Quantity),
                    PaymentMethod = sd.Sale.PaymentMethod
                })
                .AsNoTracking()
                .ToListAsync();

            return details;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting sales profit");
            return StatusCode(500, "Internal Server Error during Sales Profit calculation: " + ex.Message);
        }
    }
}
