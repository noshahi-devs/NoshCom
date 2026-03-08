using Abp.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Elicom.Entities
{
    /// <summary>
    /// Represents a category entity with name, slug, image URL, status, and timestamps.
    /// </summary>
    public class Category : Entity<Guid>, IMayHaveTenant
    {
        public int? TenantId { get; set; }
        /// <summary>
        /// Gets or sets the name of the category.
        /// </summary>
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets the slug for the category.
        /// </summary>
        public string Slug { get; set; }

        /// <summary>
        /// Gets or sets the image URL for the category.
        /// </summary>
        public string ImageUrl { get; set; }

        /// <summary>
        /// Gets or sets the status of the category.
        /// </summary>
        public bool Status { get; set; }

        /// <summary>
        /// Gets or sets the creation date and time of the category.
        /// </summary>
        public DateTime CreatedAt { get; set; }

        /// <summary>
        /// Gets or sets the last updated date and time of the category.
        /// </summary>
        public DateTime UpdatedAt { get; set; }
        public virtual ICollection<Product> Products { get; set; }
    }
}
