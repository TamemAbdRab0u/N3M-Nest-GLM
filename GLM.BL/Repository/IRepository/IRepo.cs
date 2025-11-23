using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Repository.IRepository
{
    public interface IRepo<T> where T : class
    {
        public Task<IEnumerable<T>> GetAll();
        public Task<T?> GetById(int id);
        public Task<T> Add(T entity);
        public Task<T> Update(T entity);
        public Task<bool> Delete(int id);
        public IQueryable<T> Query();
    }
}
