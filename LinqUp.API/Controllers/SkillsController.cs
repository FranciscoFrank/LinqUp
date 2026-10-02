using LinqUp.API.Data;
using LinqUp.Shared.Dtos.Profile;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LinqUp.API.Controllers
{
    [Route("api/skills")]
    [ApiController]
    public class SkillsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public SkillsController(AppDbContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<ActionResult<List<SkillDto>>> GetCatalog([FromQuery] string? search)
        {
            var query = _db.Skills.AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(s => s.Name.ToLower().Contains(term));
            }

            var skills = await query
                .OrderByDescending(s => s.IsPreset)
                .ThenBy(s => s.Name)
                .ToListAsync();

            return Ok(skills.Select(s => new SkillDto { Id = s.Id, Name = s.Name, IsPreset = s.IsPreset }));
        }
    }
}
