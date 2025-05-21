// Dropdown toggle functionality for all pages with headers
document.addEventListener('DOMContentLoaded', function() {
    // Look for all dropdown elements on the page
    const dropdowns = document.querySelectorAll('.dropdown');
    
    dropdowns.forEach(dropdown => {
        const dropdownIcon = dropdown.querySelector('.dropdown-icon');
        const dropdownContent = dropdown.querySelector('.dropdown-content');
        
        if (dropdownIcon && dropdownContent) {
            // Toggle dropdown on click
            dropdownIcon.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation(); // Prevent event bubbling
                
                // Close any other open dropdowns first
                document.querySelectorAll('.dropdown-content').forEach(content => {
                    if (content !== dropdownContent && content.style.display === 'block') {
                        content.style.display = 'none';
                    }
                });
                
                // Toggle current dropdown
                dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
            });
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        document.querySelectorAll('.dropdown').forEach(dropdown => {
            const dropdownIcon = dropdown.querySelector('.dropdown-icon');
            const dropdownContent = dropdown.querySelector('.dropdown-content');
            
            if (dropdownContent && 
                dropdownIcon && 
                !dropdownIcon.contains(e.target) && 
                !dropdownContent.contains(e.target)) {
                dropdownContent.style.display = 'none';
            }
        });
    });
}); 