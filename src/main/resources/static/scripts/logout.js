// Handle secure logout with CSRF token
function handleLogout() {
    const logoutLinks = document.querySelectorAll('a[href="/logout"]');
    
    logoutLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Create a form for POST logout
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/logout';
            
            // Add CSRF token if available
            const csrfToken = document.querySelector('meta[name="_csrf"]')?.getAttribute('content');
            const csrfHeader = document.querySelector('meta[name="_csrf_header"]')?.getAttribute('content');
            
            if (csrfToken && csrfHeader) {
                const csrfInput = document.createElement('input');
                csrfInput.type = 'hidden';
                csrfInput.name = '_csrf';
                csrfInput.value = csrfToken;
                form.appendChild(csrfInput);
            }
            
            // Append form to body, submit it, and then remove it
            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
        });
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    handleLogout();
}); 