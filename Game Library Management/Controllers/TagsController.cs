using Game_Library_Management_BL.DTO_s.TagsDto;
using Game_Library_Management_BL.Services.IServices;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Game_Library_Management.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TagsController : ControllerBase
    {
        private readonly ITagServices tagservices;
        public TagsController(ITagServices tagservices)
        {
            this.tagservices = tagservices;
        }

        [HttpGet("GetAllTags")]
        public async Task<IActionResult> GetAllTags()
        {
            var Tags = await tagservices.AllTagsAsync();
            if(Tags == null)
                return NotFound("There Is No Tags Yet.");

            return Ok(Tags.Select(x => new { x.Name, x.Description }));
        }

        [HttpGet("GetTagById")]
        public async Task<IActionResult> GetTagById(int Id)
        {
            var tag = await tagservices.TagByIdAsync(Id);
            if(tag == null)
                return NotFound("This Tag Does not Exist");

            return Ok(new {tag.Name, tag.Description});
        }

        [HttpPost("CreateTag")]
        public async Task<IActionResult> CreateTag([FromBody]TagCreateDto tagDto)
        {
            var CreatedTag = await tagservices.CreateTagAsync(tagDto);
            if(CreatedTag == null)
                return NotFound();

            return CreatedAtAction(nameof(GetTagById), new { id = CreatedTag.Id }, new {CreatedTag.Name, CreatedTag.Description});
        }

        [HttpPatch("UpdateTag")]
        public async Task<IActionResult> UpdateTag(int Id, [FromBody]TagUpdateDto tagDto)
        {
            var UpdatedTag = await tagservices.PatchTagAsync(Id, tagDto);
            if(UpdatedTag == null)
                return NotFound("This Tag Does Not Found");

            return Ok(new {UpdatedTag.Name, UpdatedTag.Description});
        }

        [HttpDelete("DeleteTag")]
        public async Task<IActionResult> DeleteTag(int Id)
        {
            var result = await tagservices.RemoveTagAsync(Id);

            if (!result)
                return NotFound("There Is Not Tag To Remove");

            return NoContent();
        }
    }
}
