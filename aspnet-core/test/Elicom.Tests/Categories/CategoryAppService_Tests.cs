using Abp.Application.Services.Dto;
using Elicom.Categories;
using Elicom.Categories.Dto;
using Elicom.Entities;
using Shouldly;
using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Elicom.Tests.Categories
{
    public class CategoryAppService_Tests : ElicomTestBase
    {
        private readonly ICategoryAppService _categoryAppService;

        public CategoryAppService_Tests()
        {
            _categoryAppService = Resolve<ICategoryAppService>();
        }

        [Fact]
        public async Task Should_Create_Category()
        {
            // Arrange
            var input = new CreateCategoryDto
            {
                Name = "Electronics",
                Slug = "electronics",
                ImageUrl = "https://example.com/electronics.jpg",
                Status = true
            };

            // Act
            var result = await _categoryAppService.Create(input);

            // Assert
            result.ShouldNotBeNull();
            result.Id.ShouldNotBe(Guid.Empty);
            result.Name.ShouldBe("Electronics");
            result.Slug.ShouldBe("electronics");
            result.Status.ShouldBeTrue();
        }

        [Fact]
        public async Task Should_Get_All_Categories()
        {
            // Arrange - Create test categories
            await _categoryAppService.Create(new CreateCategoryDto
            {
                Name = "Electronics",
                Slug = "electronics",
                Status = true
            });

            await _categoryAppService.Create(new CreateCategoryDto
            {
                Name = "Fashion",
                Slug = "fashion",
                Status = true
            });

            // Act
            var result = await _categoryAppService.GetAll();

            // Assert
            result.ShouldNotBeNull();
            result.Items.Count.ShouldBeGreaterThanOrEqualTo(2);
            result.Items.ShouldContain(c => c.Name == "Electronics");
            result.Items.ShouldContain(c => c.Name == "Fashion");
        }

        [Fact]
        public async Task Should_Get_Category_By_Id()
        {
            // Arrange
            var created = await _categoryAppService.Create(new CreateCategoryDto
            {
                Name = "Home & Living",
                Slug = "home-living",
                ImageUrl = "https://example.com/home.jpg",
                Status = true
            });

            // Act
            var result = await _categoryAppService.Get(created.Id);

            // Assert
            result.ShouldNotBeNull();
            result.Id.ShouldBe(created.Id);
            result.Name.ShouldBe("Home & Living");
            result.Slug.ShouldBe("home-living");
        }

        [Fact]
        public async Task Should_Update_Category()
        {
            // Arrange
            var created = await _categoryAppService.Create(new CreateCategoryDto
            {
                Name = "Sports",
                Slug = "sports",
                Status = true
            });

            var updateInput = new UpdateCategoryDto
            {
                Id = created.Id,
                Name = "Sports & Outdoors",
                Slug = "sports-outdoors",
                ImageUrl = "https://example.com/sports.jpg",
                Status = true
            };

            // Act
            var result = await _categoryAppService.Update(updateInput);

            // Assert
            result.ShouldNotBeNull();
            result.Id.ShouldBe(created.Id);
            result.Name.ShouldBe("Sports & Outdoors");
            result.Slug.ShouldBe("sports-outdoors");
        }

        [Fact]
        public async Task Should_Delete_Category()
        {
            // Arrange
            var created = await _categoryAppService.Create(new CreateCategoryDto
            {
                Name = "Books",
                Slug = "books",
                Status = true
            });

            // Act
            await _categoryAppService.Delete(created.Id);

            // Assert
            var allCategories = await _categoryAppService.GetAll();
            allCategories.Items.ShouldNotContain(c => c.Id == created.Id);
        }

        [Fact]
        public async Task Should_Create_Category_With_All_Fields()
        {
            // Arrange
            var input = new CreateCategoryDto
            {
                Name = "Beauty & Personal Care",
                Slug = "beauty-personal-care",
                ImageUrl = "https://example.com/beauty.jpg",
                Status = true
            };

            // Act
            var result = await _categoryAppService.Create(input);

            // Assert
            result.ShouldNotBeNull();
            result.Name.ShouldBe("Beauty & Personal Care");
            result.Slug.ShouldBe("beauty-personal-care");
            result.ImageUrl.ShouldBe("https://example.com/beauty.jpg");
            result.Status.ShouldBeTrue();
            result.CreatedAt.ShouldNotBe(default(DateTime));
        }
    }
}
