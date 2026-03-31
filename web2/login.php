<?php
session_start();
// Redirect if already logged in
if (isset($_SESSION['user_id'])) {
    if (isset($_SESSION['is_admin']) && $_SESSION['is_admin']) {
        header("Location: adminpage.php");
    } else {
        header("Location: home.php");
    }
    exit();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login</title>
    <link rel="icon" type="image/jpeg" href="./assets/ByteArena.jpg">
    <link rel="stylesheet" href="./style/login.css">
</head>
<body>
    <div class="container-login">
        <form action="./backend/loginConfig.php" method="POST">
            <h1>Login</h1>

            <?php if (isset($_GET['error'])): ?>
                <div class="alert alert-danger" style="color: red; padding: 10px; margin-bottom: 15px; border: 1px solid red; border-radius: 5px;">
                    <?php echo htmlspecialchars($_GET['error']); ?>
                </div>
            <?php endif; ?>

            <?php if (isset($_GET['success'])): ?>
                <div class="alert alert-success" style="color: green; padding: 10px; margin-bottom: 15px; border: 1px solid green; border-radius: 5px;">
                    <?php echo htmlspecialchars($_GET['success']); ?>
                </div>
            <?php endif; ?>

            <div class="input-field">
                <label for="username">Username:</label>
                <input type="text" id="username" name="username" required>
            </div>
            <div class="input-field">
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required>
            </div>
            <div class="input-field">
                <button type="submit">Login</button>
            </div>
            <div class="input-field">
                <p>Do not have an account? <a href="register.php">Register here</a></p>
            </div>
        </form>
    </div>
</body>
</html>