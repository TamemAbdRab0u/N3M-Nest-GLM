namespace Game_Library_Management_DAL.Models
{
    public class GameScreenshot
    {
        public int Id { get; set; }
        public int GameId { get; set; }
        public string ImageUrl { get; set; } = string.Empty;
        public int DisplayOrder { get; set; }

        public Game Game { get; set; } = null!;
    }
}
