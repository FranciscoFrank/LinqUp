using System;
using Microsoft.AspNetCore.Mvc;

namespace LinqUp.Web.Controllers;

public class ProjectsController : Controller
{
    public IActionResult Index() => View();

    public IActionResult Details(Guid id)
    {
        ViewBag.ProjectId = id;
        return View();
    }
}
