package com.example.demo.controller;

import com.example.demo.model.User;
import com.example.demo.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

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
    
    
}
