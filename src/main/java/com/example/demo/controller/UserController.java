package com.example.demo.controller;

import com.example.demo.model.User;
import com.example.demo.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.example.demo.security.CustomUserDetails;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

@Controller
public class UserController {

    @Autowired
    private UserService userService;

    @GetMapping("/welcome")
    public String showWelcome(Model model) {
        model.addAttribute("user", new User());
        return "welcome";
    }

    @GetMapping("/signup")
    public String showSignupPage(Model model) {
        model.addAttribute("user", new User());
        return "signup";
    }

    @PostMapping("/user/validate")
    public String validateUser(@ModelAttribute User user, Model model) {
        System.out.println("🔹 Received registration request for: " + user.getEmail());

        try {
            if (user.getEmail() == null || user.getPassword() == null || user.getFirstName() == null || user.getLastName() == null) {
                System.out.println("❌ Registration failed: Missing required fields.");
                model.addAttribute("error", "⚠️ All fields are required. Please fill them in.");
                return "signup";
            }

            if (!user.getPassword().equals(user.getConfirmPassword())) {
                System.out.println("❌ Registration failed: Passwords do not match.");
                model.addAttribute("error", "⚠️ Passwords do not match. Please try again.");
                return "signup";
            }

            User savedUser = userService.save(user);
            if (savedUser == null) {
                System.out.println("❌ Registration failed: UserService returned null.");
                model.addAttribute("error", "❌ User registration failed!");
                return "signup";
            }

            System.out.println("✅ Registration successful: " + savedUser.getEmail());
            return "redirect:/login?registered=true";

        } catch (Exception e) {
            System.out.println("❌ Registration error: " + e.getMessage());
            model.addAttribute("error", "❌ " + e.getMessage());
            return "signup";
        }
    }

    @GetMapping("/login")
    public String showLoginPage(@RequestParam(value = "error", required = false) String error,
                                @RequestParam(value = "logout", required = false) String logout,
                                @RequestParam(value = "registered", required = false) String registered,
                                @RequestParam(value = "resetSuccess", required = false) String resetSuccess,
                                Model model) {
        if (error != null) {
            model.addAttribute("errorMessage", "❌ Invalid email or password. Please try again.");
        }
        if (logout != null) {
            model.addAttribute("logoutMessage", "🔒 You have been logged out. See you again soon!");
        }
        if (registered != null) {
            model.addAttribute("successMessage", "✅ An email has been sent to your account, please verify your email before logging in.");
        }
        if (resetSuccess != null) {
            model.addAttribute("successMessage", "✅ Your password has been changed! Please log in.");
        }
    
        return "login";
    }
    
    @GetMapping("/forgotpassword")
    public String showForgotPasswordPage(@RequestParam(value = "success", required = false) String success,
                                         @RequestParam(value = "error", required = false) String error,
                                         Model model) {
        if (success != null) {
            model.addAttribute("successMessage", "✅ A password reset link has been sent to that email.");
        }
        if (error != null) {
            model.addAttribute("errorMessage", "❌ Error sending password reset email. Please try again.");
        }
        return "forgotpassword";
    }
    

    @PostMapping("/forgotpassword")
    public String forgotPassword(@RequestParam String email, Model model) {
        try {
            userService.generateResetToken(email);
            return "redirect:/forgotpassword?success=true"; // Redirect to show success message
        } catch (Exception e) {
            return "redirect:/forgotpassword?error=true"; // Redirect to show error message
        }
    }

    @GetMapping("/resetpassword")
    public String showResetPasswordForm(@RequestParam String token, Model model) {
        System.out.println("🛠 Received token for reset page: " + token);
    
        if (!userService.isValidResetToken(token)) {
            model.addAttribute("error", "❌ Invalid or expired reset token.");
            return "resetpassword";
        }
    
        model.addAttribute("token", token);
        return "resetpassword";
    }
    

    @PostMapping("/resetpassword")
    public String resetPassword(@RequestParam String token, 
                                @RequestParam String password, 
                                @RequestParam String confirmPassword, 
                                Model model) {
        
        if (!password.equals(confirmPassword)) {
            model.addAttribute("error", "⚠️ Passwords do not match. Please try again.");
            model.addAttribute("token", token);
            return "resetpassword"; // Reload page with error
        }
    
        boolean success = userService.resetPassword(token, password);
        if (success) {
            return "redirect:/login?resetSuccess=true"; // Redirect to login with success message
        } else {
            model.addAttribute("error", "❌ Invalid or expired token.");
            return "resetpassword";
        }
    }

    @GetMapping("/user/verify")
    public String verifyEmail(@RequestParam("token") String token, Model model) {
        boolean verified = userService.verifyEmail(token);
        
        if (verified) {
            return "redirect:/login?verified=true";  // Redirect to login with success message
        } else {
            return "redirect:/login?error=invalidToken"; // Redirect to login with error message
        }
    }

    @GetMapping("/user/profile")
    public String showProfile(@AuthenticationPrincipal CustomUserDetails userDetails, Model model) {
        User user = userDetails.getUser();
        model.addAttribute("user", user);
        return "profile";
    }

    @PostMapping("/user/profile/update")
    public String updateProfile(@AuthenticationPrincipal CustomUserDetails userDetails, 
                              @ModelAttribute User updatedUser,
                              Model model) {
        try {
            User currentUser = userDetails.getUser();
            
            // Log the birthday value before update
            System.out.println("🔹 Birthday before update: " + updatedUser.getBirthday());
            
            // Ensure email cannot be changed
            updatedUser.setEmail(currentUser.getEmail());
            
            // Update the user
            User savedUser = userService.updateProfile(currentUser.getId(), updatedUser);
            
            // Log the birthday value after update
            System.out.println("✅ Birthday after update: " + savedUser.getBirthday());
            
            // Update the authentication with the fresh user data
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            CustomUserDetails newDetails = new CustomUserDetails(savedUser);
            Authentication newAuth = new UsernamePasswordAuthenticationToken(
                newDetails, auth.getCredentials(), auth.getAuthorities());
            SecurityContextHolder.getContext().setAuthentication(newAuth);
            
            model.addAttribute("message", "Profile updated successfully!");
            model.addAttribute("user", savedUser);
            return "profile";
        } catch (Exception e) {
            System.out.println("❌ Error updating profile: " + e.getMessage());
            model.addAttribute("error", "Failed to update profile: " + e.getMessage());
            model.addAttribute("user", userDetails.getUser());
            return "profile";
        }
    }

    @PostMapping("/user/profile/picture")
    public String updateProfilePicture(@AuthenticationPrincipal CustomUserDetails userDetails,
                                     @RequestParam("profilePicture") MultipartFile file,
                                     Model model) {
        try {
            if (file.isEmpty()) {
                model.addAttribute("error", "Please select a file to upload");
                return "redirect:/user/profile";
            }

            // Validate file type
            String contentType = file.getContentType();
            if (contentType == null || !contentType.startsWith("image/")) {
                model.addAttribute("error", "Only image files are allowed");
                return "redirect:/user/profile";
            }

            // Validate file size (5MB max)
            if (file.getSize() > 5 * 1024 * 1024) {
                model.addAttribute("error", "File size must be less than 5MB");
                return "redirect:/user/profile";
            }

            User updatedUser = userService.updateProfilePicture(userDetails.getUser().getId(), file);
            
            // Update the authentication with the fresh user data
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            CustomUserDetails newDetails = new CustomUserDetails(updatedUser);
            Authentication newAuth = new UsernamePasswordAuthenticationToken(
                newDetails, auth.getCredentials(), auth.getAuthorities());
            SecurityContextHolder.getContext().setAuthentication(newAuth);
            
            model.addAttribute("message", "Profile picture updated successfully!");
            model.addAttribute("user", updatedUser);
            return "profile";
        } catch (Exception e) {
            model.addAttribute("error", "Failed to update profile picture: " + e.getMessage());
            model.addAttribute("user", userDetails.getUser());
            return "profile";
        }
    }
}
