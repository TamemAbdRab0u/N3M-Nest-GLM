using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace Game_Library_Management_DAL.Models
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum Gamestatus
    {
        playing = 1,
        whishlist = 2,
        completed = 3,
        Dropped = 4,
        OnHold = 5
    }
}
