using Game_Library_Management_BL.Repository.IRepository;
using Game_Library_Management_DAL.Data;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Repository.Repository
{
    public class Repo<T> : IRepo<T> where T : class
    {
        private readonly AppDbContext context;
        private readonly DbSet<T> dbSet;
        public Repo(AppDbContext context)
        {
            this.context = context;
            dbSet = context.Set<T>();
        }

        public async Task<IEnumerable<T>> GetAll()
        {
            return await dbSet.ToListAsync();
        }

        public async Task<T?> GetById(int id)
        {
            return await dbSet.FindAsync(id);
        }

        public async Task<T> Add(T entity)
        {
            var Entity = await dbSet.AddAsync(entity);
            return Entity.Entity;
        }

        public async Task<T> Update(T entity)
        {
            dbSet.Attach(entity);
            dbSet.Entry(entity).State = EntityState.Modified;
            return entity;
        }

        public async Task<bool> Delete(int id)
        {
            var entiy = await GetById(id);
            if (entiy != null)
            {
                dbSet.Remove(entiy);
                return true;
            }
            return false;
        }

        public IQueryable<T> Query()
        {
            return dbSet.AsQueryable();
        }

        public void Save()
        {
            context.SaveChanges();
        }

    }
}
