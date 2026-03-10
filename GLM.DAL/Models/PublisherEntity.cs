namespace Game_Library_Management_DAL.Models
{
    public class PublisherEntity
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;

        public List<GamePublisher> GamePublishers { get; set; } = new();
    }
}
