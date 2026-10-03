using Microsoft.AspNetCore.Mvc;

namespace LinqUp.Web.Controllers;

public class SessionsController : Controller
{
    public IActionResult Index()
    {
        var culture = RouteData.Values["culture"]?.ToString() ?? "uk";
        return Redirect($"/{culture}/Profile/Me?tab=sessions");
    }
}
