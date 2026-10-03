using LinqUp.Web.Models;
using LinqUp.Web.Services;
using Microsoft.AspNetCore.Mvc;

namespace LinqUp.Web.Controllers
{
    public class ContactController : ControllerBase
    {
        private readonly IEmailSender _emailSender;

        public ContactController(IEmailSender emailSender)
        {
            _emailSender = emailSender;
        }

        [HttpPost]
        public async Task<IActionResult> Send([FromBody] ContactFormRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name) ||
                string.IsNullOrWhiteSpace(request.Email) ||
                string.IsNullOrWhiteSpace(request.Subject) ||
                string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest();
            }

            var sent = await _emailSender.SendContactMessageAsync(
                request.Name.Trim(), request.Email.Trim(), request.Subject.Trim(), request.Message.Trim());

            return sent ? Ok() : StatusCode(StatusCodes.Status502BadGateway);
        }
    }
}
