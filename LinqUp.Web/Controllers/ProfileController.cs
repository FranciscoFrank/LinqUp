using Microsoft.AspNetCore.Mvc;

namespace LinqUp.Web.Controllers;

public class ProfileController : Controller
{
    public IActionResult Me() => View();

    public IActionResult Public(string nickname)
    {
        ViewBag.Nickname = nickname;
        return View();
    }
}
