using Microsoft.AspNetCore.Mvc;

namespace LinqUp.Web.Controllers;

public class SecurityController : Controller
{
    public IActionResult Index()
    {
        var culture = RouteData.Values["culture"]?.ToString() ?? "uk";
        return Redirect($"/{culture}/Profile/Me?tab=security");
    }
}
