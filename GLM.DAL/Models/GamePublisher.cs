namespace Game_Library_Management_DAL.Models
{
    public class GamePublisher
    {
        public int GameId { get; set; }
        public int PublisherEntityId { get; set; }

        public Game Game { get; set; } = null!;
        public PublisherEntity PublisherEntity { get; set; } = null!;
    }
}
