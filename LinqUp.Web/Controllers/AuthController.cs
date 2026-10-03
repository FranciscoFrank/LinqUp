using Microsoft.AspNetCore.Mvc;

namespace LinqUp.Web.Controllers;

public class AuthController : Controller
{
    public IActionResult Login() => View();

    public IActionResult Register() => View();

    public IActionResult ForgotPassword() => View();

    public IActionResult ResetPassword() => View();

    public IActionResult ConfirmEmail() => View();
}
