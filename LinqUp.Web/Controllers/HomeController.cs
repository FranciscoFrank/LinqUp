using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using LinqUp.Web.Models;

namespace LinqUp.Web.Controllers;

public class HomeController : Controller
{
    public IActionResult Index()
    {
        return View();
    }

    public IActionResult Privacy()
    {
        return View();
    }

    public IActionResult Terms()
    {
        return View();
    }

    public IActionResult Faq()
    {
        return View();
    }

    public IActionResult Cookies()
    {
        var culture = RouteData.Values["culture"]?.ToString() ?? "uk";
        return Redirect($"/{culture}/Home/Privacy#cookies");
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
