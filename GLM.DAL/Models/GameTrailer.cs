namespace Game_Library_Management_DAL.Models
{
    public class GameTrailer
    {
        public int Id { get; set; }
        public int GameId { get; set; }
        public string VideoUrl { get; set; } = string.Empty;
        public string? PreviewImageUrl { get; set; }

        public Game Game { get; set; } = null!;
    }
}
